import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchCloudStatus } from '../api/cloud'
import { getLocalLibraryCounts } from '../db/restoreService'
import { isRestoreDismissed, setRestoreDismissed } from '../db/syncStateService'
import { decideRestoreAction } from '../sync/restoreLogic'
import { restoreLibraryFromCloud } from '../utils/cloudRestore'
import { useAuth } from '../hooks/useAuth'
import { useArtworks } from '../hooks/useArtworks'
import { formatUserError } from '../utils/userErrors'
import { RestoreContext } from './restoreContext'

const INITIAL_STATE = {
  phase: 'idle',
  progress: null,
  result: null,
  error: null,
}

export function RestoreProvider({ children }) {
  const { user, authenticated, loading: authLoading } = useAuth()
  const { refresh } = useArtworks()
  const [restoreState, setRestoreState] = useState(INITIAL_STATE)
  const [promptVisible, setPromptVisible] = useState(false)
  const restoringRef = useRef(false)

  const userId = user?.id ?? null

  const runRestore = useCallback(async () => {
    if (!userId || restoringRef.current) {
      return
    }

    restoringRef.current = true
    setPromptVisible(false)
    setRestoreState({
      phase: 'restoring',
      progress: { phase: 'checking', message: 'Checking cloud...', current: 0, total: 0 },
      result: null,
      error: null,
    })

    try {
      const result = await restoreLibraryFromCloud({
        userId,
        onProgress: (progress) =>
          setRestoreState((prev) => ({ ...prev, phase: 'restoring', progress })),
      })
      await refresh()
      setRestoreState({ phase: 'done', progress: null, result, error: null })
    } catch (error) {
      setRestoreState({
        phase: 'error',
        progress: null,
        result: null,
        error: formatUserError(error, 'Failed to restore from cloud. Your local library is unchanged.'),
      })
    } finally {
      restoringRef.current = false
    }
  }, [userId, refresh])

  useEffect(() => {
    if (authLoading) {
      return undefined
    }

    if (!authenticated || !userId) {
      restoringRef.current = false
      return undefined
    }

    let cancelled = false

    async function checkOnLogin() {
      setRestoreState((prev) =>
        prev.phase === 'idle' ? { ...prev, phase: 'checking' } : prev,
      )

      try {
        const [localCounts, cloudStatus, restoreDismissed] = await Promise.all([
          getLocalLibraryCounts(),
          fetchCloudStatus(),
          isRestoreDismissed(userId),
        ])

        if (cancelled) {
          return
        }

        const action = decideRestoreAction({ localCounts, cloudStatus, restoreDismissed })

        if (action === 'auto-restore') {
          await runRestore()
        } else if (action === 'prompt') {
          setPromptVisible(true)
          setRestoreState((prev) =>
            prev.phase === 'checking' ? { ...prev, phase: 'idle' } : prev,
          )
        } else {
          setRestoreState((prev) =>
            prev.phase === 'checking' ? { ...prev, phase: 'idle' } : prev,
          )
        }
      } catch (error) {
        if (!cancelled) {
          const isAuthFailure =
            error?.status === 401 ||
            error?.status === 403 ||
            error?.code === 'unauthorized'
          if (isAuthFailure) {
            setRestoreState({
              phase: 'error',
              progress: null,
              result: null,
              error: formatUserError(error, 'Your session expired. Sign in again.'),
            })
          } else {
            setRestoreState((prev) =>
              prev.phase === 'checking' ? { ...prev, phase: 'idle' } : prev,
            )
          }
        }
      }
    }

    checkOnLogin()

    return () => {
      cancelled = true
    }
  }, [authenticated, authLoading, userId, runRestore])

  const keepDevice = useCallback(async () => {
    setPromptVisible(false)
    if (userId) {
      await setRestoreDismissed(userId)
    }
  }, [userId])

  const value = useMemo(
    () => ({
      restoreState: authenticated ? restoreState : INITIAL_STATE,
      promptVisible: authenticated ? promptVisible : false,
      restoreNow: runRestore,
      keepDevice,
    }),
    [authenticated, restoreState, promptVisible, runRestore, keepDevice],
  )

  return <RestoreContext.Provider value={value}>{children}</RestoreContext.Provider>
}
