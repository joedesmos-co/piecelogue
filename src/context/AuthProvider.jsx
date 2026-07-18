import { useCallback, useEffect, useState } from 'react'
import { fetchMe, logout, requestSignInLink } from '../api/auth'
import { clearSignedOutLibraryFlag } from '../utils/clearLocalLibrary'
import { onUnauthorized } from '../utils/apiDiagnostics'
import { AuthContext } from './authContext'

const SESSION_EXPIRED_MESSAGE = 'Your session expired. Sign in again.'

function clearAuthQueryParams() {
  const url = new URL(window.location.href)
  const authStatus = url.searchParams.get('auth')
  if (!authStatus) return false

  url.searchParams.delete('auth')
  url.searchParams.delete('view')
  const nextUrl = `${url.pathname}${url.search}${url.hash}`
  window.history.replaceState({}, '', nextUrl)
  return authStatus === 'success'
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const applySession = useCallback((result, { expired = false } = {}) => {
    const isAuthenticated = Boolean(result?.authenticated)
    setAuthenticated(isAuthenticated)
    setUser(isAuthenticated ? result.user : null)
    if (isAuthenticated) {
      clearSignedOutLibraryFlag()
      setError(null)
    } else if (expired) {
      setError(SESSION_EXPIRED_MESSAGE)
    }
    return {
      authenticated: isAuthenticated,
      user: isAuthenticated ? result.user : null,
    }
  }, [])

  const clearSession = useCallback((message = SESSION_EXPIRED_MESSAGE) => {
    setAuthenticated(false)
    setUser(null)
    setError(message)
    setLoading(false)
  }, [])

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const result = await fetchMe()
      return applySession(result)
    } catch (err) {
      clearSession(err.message || 'Failed to load account.')
      return { authenticated: false, user: null }
    } finally {
      setLoading(false)
    }
  }, [applySession, clearSession])

  useEffect(() => {
    let cancelled = false

    async function load() {
      clearAuthQueryParams()

      try {
        setError(null)
        const result = await fetchMe()
        if (!cancelled) {
          applySession(result)
        }
      } catch (err) {
        if (!cancelled) {
          clearSession(err.message || 'Failed to load account.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [applySession, clearSession])

  useEffect(() => {
    return onUnauthorized(() => {
      clearSession(SESSION_EXPIRED_MESSAGE)
    })
  }, [clearSession])

  useEffect(() => {
    let cancelled = false

    async function revalidate() {
      if (document.visibilityState === 'hidden') {
        return
      }
      try {
        const result = await fetchMe()
        if (cancelled) {
          return
        }
        if (!result.authenticated) {
          applySession(result, { expired: authenticated })
        } else {
          applySession(result)
        }
      } catch {
        // Network blips during focus/visibility must not wipe a live session.
        // 401s from other cloud calls clear auth via onUnauthorized.
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        revalidate()
      }
    }

    window.addEventListener('focus', revalidate)
    window.addEventListener('pageshow', revalidate)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      window.removeEventListener('focus', revalidate)
      window.removeEventListener('pageshow', revalidate)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [applySession, authenticated, clearSession])

  const requestLink = useCallback(async (email) => {
    return requestSignInLink(email)
  }, [])

  const signOut = useCallback(async () => {
    await logout()
    await refresh()
  }, [refresh])

  const value = {
    user,
    authenticated,
    loading,
    error,
    refresh,
    requestLink,
    signOut,
    clearSession,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
