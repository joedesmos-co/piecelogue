import { useCallback, useEffect, useState } from 'react'
import { fetchMe, logout, requestSignInLink } from '../api/auth'
import { clearSignedOutLibraryFlag } from '../utils/clearLocalLibrary'
import { AuthContext } from './authContext'

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

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const result = await fetchMe()
      setAuthenticated(result.authenticated)
      setUser(result.user)
      if (result.authenticated) {
        clearSignedOutLibraryFlag()
      }
      return result
    } catch (err) {
      setError(err.message || 'Failed to load account.')
      setAuthenticated(false)
      setUser(null)
      return { authenticated: false, user: null }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      clearAuthQueryParams()

      try {
        setError(null)
        const result = await fetchMe()
        if (!cancelled) {
          setAuthenticated(result.authenticated)
          setUser(result.user)
          if (result.authenticated) {
            clearSignedOutLibraryFlag()
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load account.')
          setAuthenticated(false)
          setUser(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

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
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
