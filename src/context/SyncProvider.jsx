import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { setActiveSyncUserId } from '../sync/activeUser'
import { setSyncWakeHandler } from '../sync/enqueue'
import { startAutoSync, stopAutoSync } from '../sync/autoSync'
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
import { clearRetryScheduler, recoverStuckProcessingJobs } from '../sync/retryScheduler'
import { resetSyncUploadRuntimeState } from '../sync/processor'
import { notifyCloudDataChanged } from '../sync/cloudDataEvents'
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
      stopAutoSync()
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

    // Automatic multi-device sync. Starts a coordinator that handles app load,
    // login, focus, reconnect, local edits and a visible-tab interval.
    // SyncProvider renders ABOVE ArtworkProvider, so it cannot read that
    // context; it broadcasts instead and ArtworkProvider listens.
    startAutoSync({
      userId,
      onChanged: () => {
        if (cancelled) {
          return
        }
        notifyCloudDataChanged()
        refreshSyncStatus(userId)
      },
    })

    return () => {
      cancelled = true
      setActiveSyncUserId(null)
      stop()
      stopSyncProcessor()
      stopAutoSync()
      clearRetryScheduler()
    }
  }, [authenticated, authLoading, userId])

  // Local-only housekeeping on visibility change. All network activity is owned
  // by the auto-sync coordinator, so this must not duplicate its requests.
  useEffect(() => {
    if (!userId) {
      return undefined
    }

    async function recoverStuck() {
      const recovered = await recoverStuckProcessingJobs(userId)
      if (recovered > 0) {
        resetSyncUploadRuntimeState()
        refreshSyncStatus(userId)
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        recoverStuck()
      }
    }

    function handleOffline() {
      refreshSyncStatus(userId)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('offline', handleOffline)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
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
