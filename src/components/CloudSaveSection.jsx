import { useEffect, useState } from 'react'
import { Cloud, LoaderCircle, RefreshCw } from 'lucide-react'
import { fetchCloudStatus } from '../api/cloud'
import { useAuth } from '../hooks/useAuth'
import { useRestore } from '../hooks/useRestore'
import { useSync } from '../hooks/useSync'
import { saveLibraryToCloud } from '../utils/cloudSave'
import { formatUserError } from '../utils/userErrors'
import { wakeSyncProcessor } from '../sync/processor'
import { getCloudSyncStatusDetails } from '../sync/cloudSyncStatus'
import { cancelForceSync } from '../sync/syncLock'
import { CloudConflictPanel } from './CloudConflictSection'
import ImageRecoveryPanel from './ImageRecoveryPanel'
import { describeSyncJobStageLabel } from '../sync/statusDetails'

function formatTimestamp(value) {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleString()
}

export default function CloudSaveSection({ authenticated }) {
  const { user } = useAuth()
  const { status, retryNow } = useSync()
  const { restoreState, promptVisible, restoreNow, keepDevice } = useRestore()
  const [cloudStatus, setCloudStatus] = useState(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [showForceWarning, setShowForceWarning] = useState(false)
  const [forcing, setForcing] = useState(false)
  const [forceError, setForceError] = useState('')
  const [progress, setProgress] = useState(null)
  const [forceResult, setForceResult] = useState(null)

  const { phase: restorePhase, progress: restoreProgress, result: restoreResult, error: restoreError } =
    restoreState
  const isRestoring = restorePhase === 'restoring'
  const isRestoreChecking = restorePhase === 'checking'
  const showRestoreActiveState =
    promptVisible ||
    isRestoreChecking ||
    isRestoring ||
    restorePhase === 'done' ||
    restorePhase === 'error'
  const restoreProgressPercent =
    restoreProgress?.total > 0
      ? Math.round((restoreProgress.current / restoreProgress.total) * 100)
      : null

  useEffect(() => {
    if (!authenticated) {
      return
    }

    let cancelled = false

    async function loadStatus() {
      setStatusLoading(true)
      setStatusError('')

      try {
        const remoteStatus = await fetchCloudStatus()
        if (!cancelled) {
          setCloudStatus(remoteStatus)
        }
      } catch (err) {
        if (!cancelled) {
          setStatusError(formatUserError(err, 'Could not load cloud status.'))
        }
      } finally {
        if (!cancelled) {
          setStatusLoading(false)
        }
      }
    }

    loadStatus()
    return () => {
      cancelled = true
    }
  }, [authenticated, forceResult, status.lastSyncedAt, restoreResult])

  async function handleForceSync() {
    setShowForceWarning(false)
    setForcing(true)
    setForceError('')
    setForceResult(null)
    setProgress({
      phase: 'starting',
      message: 'Preparing full library upload...',
      current: 0,
      total: 0,
    })

    try {
      const result = await saveLibraryToCloud({
        userId: user?.id,
        onProgress: setProgress,
      })
      setForceResult(result)
      const remoteStatus = await fetchCloudStatus()
      setCloudStatus(remoteStatus)
      wakeSyncProcessor()
    } catch (err) {
      if (err?.code !== 'cancelled') {
        setForceError(formatUserError(err, 'Force sync failed. Your local library is unchanged.'))
      }
    } finally {
      setForcing(false)
      setProgress(null)
    }
  }

  function handleCancelForceSync() {
    cancelForceSync()
    setForcing(false)
    setProgress(null)
    setForceError('')
  }

  if (!authenticated) {
    return (
      <section className="settings-section">
        <h3 className="settings-section-title">
          <Cloud size={18} />
          Cloud Sync
        </h3>
        <div className="settings-card settings-card--placeholder">
          <p className="settings-text settings-text--muted">
            Sign in to automatically sync your library to your Piecelogue account.
          </p>
        </div>
      </section>
    )
  }

  const statusDetails = getCloudSyncStatusDetails(status, forcing)
  const lastSyncedAt = formatTimestamp(status.lastSyncedAt || cloudStatus?.lastSavedAt)
  const progressPercent =
    progress?.total > 0 ? Math.round((progress.current / progress.total) * 100) : null
  const isBusy =
    status.state === 'syncing' || forcing || isRestoring || isRestoreChecking
  const canForceSync = !forcing && !isRestoring && !isRestoreChecking

  return (
    <section className="settings-section" aria-labelledby="cloud-sync-heading">
      <h3 id="cloud-sync-heading" className="settings-section-title">
        <Cloud size={18} />
        Cloud Sync
      </h3>

      <div className="settings-card">
        <p className="settings-text settings-text--muted">
          Changes and deletes on this device sync automatically while you are signed in. Deleting
          here removes items from your cloud library too.
        </p>

        <div
          className={`sync-status-banner sync-status-banner--${status.state}`}
          role="status"
          aria-live="polite"
          aria-busy={isBusy}
        >
          {isBusy ? (
            <LoaderCircle size={16} className="cloud-save-spinner" aria-hidden="true" />
          ) : null}
          <div>
            {statusDetails.label ? (
              <p className="sync-status-label">{statusDetails.label}</p>
            ) : null}
            {statusDetails.description ? (
              <p className="settings-text settings-text--muted">{statusDetails.description}</p>
            ) : null}
            {lastSyncedAt ? (
              <p className="settings-text settings-text--muted">Last synced: {lastSyncedAt}</p>
            ) : (
              <p className="settings-text settings-text--muted">Not synced yet.</p>
            )}
          </div>
        </div>

        {status.state === 'error' ? (
          <button type="button" className="btn btn--secondary btn--sm" onClick={retryNow}>
            <RefreshCw size={14} aria-hidden="true" />
            Retry now
          </button>
        ) : null}

        {status.failures?.length > 0 ? (
          <div className="sync-failure-details" role="status">
            <p className="settings-text settings-text--muted">Sync issues by stage:</p>
            <ul className="sync-failure-list">
              {status.failures.map((failure) => (
                <li key={failure.stage} className="sync-failure-item">
                  <strong>{describeSyncJobStageLabel(failure.stage)}</strong>
                  {failure.count > 1 ? ` (${failure.count} items)` : ''}: {failure.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <CloudConflictPanel />

        {status.state === 'recovery_required' || status.recoveryRequired?.length > 0 ? (
          <ImageRecoveryPanel entries={status.recoveryRequired ?? []} onRepaired={retryNow} />
        ) : null}

        {statusLoading ? (
          <p className="settings-text settings-text--muted" role="status">
            <LoaderCircle size={14} className="cloud-save-spinner" aria-hidden="true" /> Checking
            cloud library...
          </p>
        ) : null}

        {statusError ? (
          <div className="alert alert--error" role="alert">
            {statusError}
          </div>
        ) : null}

        {!statusLoading && cloudStatus ? (
          <div className="cloud-status-summary">
            <p className="settings-text">
              Cloud library: {cloudStatus.folderCount} folders, {cloudStatus.artworkCount} artworks
            </p>
          </div>
        ) : null}

        <div className="cloud-sync-restore">
          <p className="settings-text settings-text--muted">
            Download your cloud library to this device. If this device already has artwork, you will
            be asked before anything is replaced.
          </p>

          {isRestoreChecking ? (
            <p className="settings-text settings-text--muted" role="status" aria-live="polite">
              <LoaderCircle size={14} className="cloud-save-spinner" aria-hidden="true" /> Checking
              cloud library...
            </p>
          ) : null}

          {promptVisible ? (
            <div className="cloud-save-warning" role="note">
              <p className="settings-text">
                Cloud library found. Restore from cloud? This may add or replace local items on this
                device.
              </p>
              <div className="account-actions">
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={restoreNow}
                  disabled={isRestoring}
                >
                  Restore from cloud
                </button>
                <button type="button" className="btn btn--secondary btn--sm" onClick={keepDevice}>
                  Keep this device
                </button>
              </div>
            </div>
          ) : !showRestoreActiveState ? (
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={restoreNow}
              disabled={isRestoring || isRestoreChecking}
              aria-busy={isRestoring || isRestoreChecking}
            >
              Restore from cloud
            </button>
          ) : null}

          {isRestoring && restoreProgress ? (
            <div className="cloud-save-progress" aria-live="polite" role="status">
              <div className="cloud-save-progress-header">
                <LoaderCircle size={16} className="cloud-save-spinner" aria-hidden="true" />
                <span>{restoreProgress.message}</span>
              </div>
              {restoreProgressPercent !== null ? (
                <div
                  className="cloud-save-progress-bar"
                  role="progressbar"
                  aria-valuenow={restoreProgressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="cloud-save-progress-fill"
                    style={{ width: `${restoreProgressPercent}%` }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {restorePhase === 'done' && restoreResult ? (
            <div className="cloud-save-success" role="status">
              Restored {restoreResult.folderCount} folders and {restoreResult.artworkCount} artworks
              from cloud.
              {restoreResult.failedImageCount > 0
                ? ` ${restoreResult.failedImageCount} image download${restoreResult.failedImageCount === 1 ? '' : 's'} failed — metadata was restored, but some images are missing.`
                : ''}
            </div>
          ) : null}

          {restorePhase === 'done' && restoreResult?.failedImageCount > 0 ? (
            <button type="button" className="btn btn--secondary btn--sm" onClick={restoreNow}>
              Retry restore
            </button>
          ) : null}

          {restorePhase === 'error' ? (
            <>
              <div className="form-error" role="alert">
                {restoreError}
              </div>
              <button type="button" className="btn btn--secondary btn--sm" onClick={restoreNow}>
                Retry restore
              </button>
            </>
          ) : null}
        </div>

        <div className="cloud-sync-actions">
          {showForceWarning ? (
            <div className="cloud-save-warning" role="note">
              <p className="settings-text">
                Force full sync uploads this device&apos;s entire library to your account and clears
                pending auto-sync jobs. Use this if auto-sync gets stuck.
              </p>
              <div className="account-actions">
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={handleForceSync}
                  disabled={!canForceSync}
                >
                  Force full sync
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => setShowForceWarning(false)}
                  disabled={forcing}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setShowForceWarning(true)}
              disabled={!canForceSync}
            >
              Force full sync
            </button>
          )}
        </div>

        {forcing && progress ? (
          <div className="cloud-save-progress" aria-live="polite">
            <div className="cloud-save-progress-header">
              <LoaderCircle size={16} className="cloud-save-spinner" aria-hidden="true" />
              <span>{progress.message}</span>
            </div>
            {progress.artworkTitle ? (
              <p className="settings-text settings-text--muted">{progress.artworkTitle}</p>
            ) : null}
            {progress.phase === 'images' ? (
              <p className="settings-text settings-text--muted">
                {progress.format || 'Unknown format'} · Blob size:{' '}
                {typeof progress.blobSize === 'number' ? progress.blobSize : 'unknown'} bytes ·
                Upload bytes: {progress.byteSize ?? 'unknown'} · Request: {progress.requestId}
              </p>
            ) : null}
            {progressPercent !== null ? (
              <div
                className="cloud-save-progress-bar"
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="cloud-save-progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>
            ) : null}
            <button type="button" className="btn btn--secondary btn--sm" onClick={handleCancelForceSync}>
              Cancel sync
            </button>
          </div>
        ) : null}

        {forceError ? (
          <div className="form-error" role="alert">
            {forceError}
          </div>
        ) : null}

        {forceResult ? (
          <div className="cloud-save-success" role="status">
            Force synced {forceResult.folderCount} folders and {forceResult.artworkCount} artworks.
          </div>
        ) : null}
      </div>
    </section>
  )
}
