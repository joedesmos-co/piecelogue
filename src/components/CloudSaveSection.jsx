import { useEffect, useState } from 'react'
import { Cloud, LoaderCircle, RefreshCw } from 'lucide-react'
import { fetchCloudStatus } from '../api/cloud'
import { useAuth } from '../hooks/useAuth'
import { useSync } from '../hooks/useSync'
import { saveLibraryToCloud } from '../utils/cloudSave'
import { wakeSyncProcessor } from '../sync/processor'

function formatTimestamp(value) {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleString()
}

function getStatusLabel(status) {
  switch (status.state) {
    case 'up-to-date':
      return 'Up to date'
    case 'syncing':
      return 'Syncing...'
    case 'pending':
    case 'waiting':
      return `${status.pendingCount} change${status.pendingCount === 1 ? '' : 's'} waiting to sync`
    case 'offline':
      return 'Offline — changes saved locally'
    case 'error':
      return 'Sync error'
    case 'signed-out':
    default:
      return null
  }
}

export default function CloudSaveSection({ authenticated }) {
  const { user } = useAuth()
  const { status, retryNow } = useSync()
  const [cloudStatus, setCloudStatus] = useState(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [showForceWarning, setShowForceWarning] = useState(false)
  const [forcing, setForcing] = useState(false)
  const [forceError, setForceError] = useState('')
  const [progress, setProgress] = useState(null)
  const [forceResult, setForceResult] = useState(null)

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
          setStatusError(err.message || 'Failed to load cloud status.')
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
  }, [authenticated, forceResult, status.lastSyncedAt])

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
      setForceError(err.message || 'Failed to save library to cloud.')
    } finally {
      setForcing(false)
    }
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

  const statusLabel = getStatusLabel(status)
  const lastSyncedAt = formatTimestamp(status.lastSyncedAt || cloudStatus?.lastSavedAt)
  const progressPercent =
    progress?.total > 0 ? Math.round((progress.current / progress.total) * 100) : null

  return (
    <section className="settings-section">
      <h3 className="settings-section-title">
        <Cloud size={18} />
        Cloud Sync
      </h3>

      <div className="settings-card">
        <p className="settings-text settings-text--muted">
          Changes on this device sync automatically while you are signed in. Local deletes are not
          synced to the cloud yet.
        </p>

        <div className={`sync-status-banner sync-status-banner--${status.state}`}>
          {status.state === 'syncing' || forcing ? (
            <LoaderCircle size={16} className="cloud-save-spinner" aria-hidden="true" />
          ) : null}
          <div>
            <p className="sync-status-label">{forcing ? 'Force syncing...' : statusLabel}</p>
            {status.state === 'error' && status.error ? (
              <p className="settings-text settings-text--muted">{status.error}</p>
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
            <RefreshCw size={14} />
            Retry now
          </button>
        ) : null}

        {statusLoading ? (
          <p className="settings-text settings-text--muted">Loading cloud status...</p>
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
                disabled={forcing}
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
            disabled={forcing}
          >
            Force full sync
          </button>
        )}

        {forcing && progress ? (
          <div className="cloud-save-progress" aria-live="polite">
            <div className="cloud-save-progress-header">
              <LoaderCircle size={16} className="cloud-save-spinner" aria-hidden="true" />
              <span>{progress.message}</span>
            </div>
            {progress.artworkTitle ? (
              <p className="settings-text settings-text--muted">{progress.artworkTitle}</p>
            ) : null}
            {progressPercent !== null ? (
              <div className="cloud-save-progress-bar" aria-hidden="true">
                <div className="cloud-save-progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>
            ) : null}
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
