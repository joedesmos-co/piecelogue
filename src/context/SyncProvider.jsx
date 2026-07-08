import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { setActiveSyncUserId } from '../sync/activeUser'
import { setSyncWakeHandler } from '../sync/enqueue'
import {
  refreshSyncStatus,
  retryFailedSync,
  seedInitialLibrarySync,
  setSyncStatusListener,
  startSyncProcessor,
  stopSyncProcessor,
  wakeSyncProcessor,
} from '../sync/processor'
import { SyncContext } from './syncContext'

const INITIAL_STATUS = {
  state: 'signed-out',
  pendingCount: 0,
  pendingDeleteCount: 0,
  lastSyncedAt: null,
  error: null,
}

export function SyncProvider({ children }) {
  const { user, authenticated, loading: authLoading } = useAuth()
  const [syncStatus, setSyncStatus] = useState(INITIAL_STATUS)

  const userId = user?.id ?? null
  const status =
    !authLoading && authenticated && userId ? syncStatus : INITIAL_STATUS

  useEffect(() => {
    setSyncStatusListener(setSyncStatus)
    setSyncWakeHandler(wakeSyncProcessor)
    return () => {
      setSyncStatusListener(null)
      setSyncWakeHandler(null)
    }
  }, [])

  useEffect(() => {
    if (authLoading) {
      return undefined
    }

    if (!authenticated || !userId) {
      setActiveSyncUserId(null)
      stopSyncProcessor()
      return undefined
    }

    let cancelled = false
    setActiveSyncUserId(userId)

    async function initialize() {
      await seedInitialLibrarySync(userId)
      if (cancelled) {
        return
      }
      wakeSyncProcessor()
      await refreshSyncStatus(userId)
    }

    const stop = startSyncProcessor(userId)
    initialize()

    return () => {
      cancelled = true
      setActiveSyncUserId(null)
      stop()
      stopSyncProcessor()
    }
  }, [authenticated, authLoading, userId])

  useEffect(() => {
    if (!userId) {
      return undefined
    }

    function handleOnline() {
      wakeSyncProcessor()
      refreshSyncStatus(userId)
    }

    function handleOffline() {
      refreshSyncStatus(userId)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [userId])

  const retryNow = useCallback(async () => {
    if (!userId) {
      return
    }
    await retryFailedSync(userId)
    await refreshSyncStatus(userId)
  }, [userId])

  const value = useMemo(
    () => ({
      status,
      retryNow,
      wakeSync: wakeSyncProcessor,
    }),
    [status, retryNow],
  )

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}
