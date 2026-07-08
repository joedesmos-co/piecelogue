import { useEffect, useState } from 'react'
import { Cloud, LoaderCircle } from 'lucide-react'
import { fetchCloudStatus } from '../api/cloud'
import { saveLibraryToCloud } from '../utils/cloudSave'

function formatSavedAt(value) {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleString()
}

export default function CloudSaveSection({ authenticated }) {
  const [cloudStatus, setCloudStatus] = useState(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [showWarning, setShowWarning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [progress, setProgress] = useState(null)
  const [saveResult, setSaveResult] = useState(null)

  useEffect(() => {
    if (!authenticated) {
      return
    }

    let cancelled = false

    async function loadStatus() {
      setStatusLoading(true)
      setStatusError('')

      try {
        const status = await fetchCloudStatus()
        if (!cancelled) {
          setCloudStatus(status)
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
  }, [authenticated, saveResult])

  async function handleConfirmSave() {
    setShowWarning(false)
    setSaving(true)
    setSaveError('')
    setSaveResult(null)
    setProgress({
      phase: 'starting',
      message: 'Preparing library upload...',
      current: 0,
      total: 0,
    })

    try {
      const result = await saveLibraryToCloud({ onProgress: setProgress })
      setSaveResult(result)
      const status = await fetchCloudStatus()
      setCloudStatus(status)
    } catch (err) {
      setSaveError(err.message || 'Failed to save library to cloud.')
    } finally {
      setSaving(false)
    }
  }

  if (!authenticated) {
    return (
      <section className="settings-section">
        <h3 className="settings-section-title">
          <Cloud size={18} />
          Cloud Storage
        </h3>
        <div className="settings-card settings-card--placeholder">
          <p className="settings-text settings-text--muted">
            Sign in to save your library to your Piecelogue account.
          </p>
        </div>
      </section>
    )
  }

  const lastSavedAt = formatSavedAt(cloudStatus?.lastSavedAt)
  const progressPercent =
    progress?.total > 0 ? Math.round((progress.current / progress.total) * 100) : null

  return (
    <section className="settings-section">
      <h3 className="settings-section-title">
        <Cloud size={18} />
        Cloud Storage
      </h3>

      <div className="settings-card">
        <p className="settings-text settings-text--muted">
          Save this device&apos;s current folders and artworks to your Piecelogue account.
          Cloud sync and restore are still in progress.
        </p>

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
            {lastSavedAt ? (
              <p className="settings-text settings-text--muted">Last saved: {lastSavedAt}</p>
            ) : (
              <p className="settings-text settings-text--muted">Not saved to cloud yet.</p>
            )}
          </div>
        ) : null}

        {showWarning ? (
          <div className="cloud-save-warning" role="note">
            <p className="settings-text">
              This saves this device&apos;s current library to your Piecelogue account. Cloud
              sync/restore is still in progress.
            </p>
            <div className="account-actions">
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={handleConfirmSave}
                disabled={saving}
              >
                Save library to cloud
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setShowWarning(false)}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => setShowWarning(true)}
            disabled={saving}
          >
            Save library to cloud
          </button>
        )}

        {saving && progress ? (
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

        {saveError ? (
          <div className="form-error" role="alert">
            {saveError}
          </div>
        ) : null}

        {saveResult ? (
          <div className="cloud-save-success" role="status">
            Saved {saveResult.folderCount} folders and {saveResult.artworkCount} artworks to cloud.
          </div>
        ) : null}
      </div>
    </section>
  )
}
