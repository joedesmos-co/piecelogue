import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { setActiveSyncUserId } from '../sync/activeUser'
import { setSyncWakeHandler } from '../sync/enqueue'
import {
  recoverSyncJobs,
  refreshSyncStatus,
  retryFailedSync,
  seedInitialLibrarySync,
  setSyncStatusListener,
  startSyncProcessor,
  stopSyncProcessor,
  wakeSyncProcessor,
} from '../sync/processor'
import { runLegacyImageMigrationBatch } from '../db/legacyImageMigration'
import { clearRetryScheduler } from '../sync/retryScheduler'
import { SyncContext } from './syncContext'

const INITIAL_STATUS = {
  state: 'signed-out',
  pendingCount: 0,
  pendingDeleteCount: 0,
  conflictCount: 0,
  lastSyncedAt: null,
  error: null,
  failures: [],
  activeUpload: null,
  forceSyncActive: false,
  recoveryRequired: [],
  incompleteCloudImages: [],
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
      clearRetryScheduler()
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
      let migrationComplete = false
      while (!migrationComplete && !cancelled) {
        const migration = await runLegacyImageMigrationBatch()
        migrationComplete = migration.complete
      }
      if (cancelled) {
        return
      }
      await seedInitialLibrarySync(userId)
      if (cancelled) {
        return
      }
      await recoverSyncJobs(userId)
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
      clearRetryScheduler()
    }
  }, [authenticated, authLoading, userId])

  useEffect(() => {
    if (!userId) {
      return undefined
    }

    async function resumeSync() {
      await recoverSyncJobs(userId)
      wakeSyncProcessor()
      await refreshSyncStatus(userId)
    }

    function handleOnline() {
      resumeSync()
    }

    function handleOffline() {
      refreshSyncStatus(userId)
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        resumeSync()
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('pageshow', resumeSync)
    window.addEventListener('focus', resumeSync)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('pageshow', resumeSync)
      window.removeEventListener('focus', resumeSync)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
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
