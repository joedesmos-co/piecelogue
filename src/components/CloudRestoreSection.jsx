import { CloudDownload, LoaderCircle } from 'lucide-react'
import { useRestore } from '../hooks/useRestore'

export default function CloudRestoreSection({ authenticated }) {
  const { restoreState, promptVisible, restoreNow, keepDevice } = useRestore()

  if (!authenticated) {
    return null
  }

  const { phase, progress, result, error } = restoreState
  const showSection = promptVisible || phase === 'restoring' || phase === 'done' || phase === 'error'

  if (!showSection) {
    return null
  }

  const progressPercent =
    progress?.total > 0 ? Math.round((progress.current / progress.total) * 100) : null

  return (
    <section className="settings-section">
      <h3 className="settings-section-title">
        <CloudDownload size={18} />
        Restore from Cloud
      </h3>

      <div className="settings-card">
        {promptVisible ? (
          <div className="cloud-save-warning" role="note">
            <p className="settings-text">
              Cloud library found. Restore from cloud? This may add/replace local items.
            </p>
            <div className="account-actions">
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={restoreNow}
              >
                Restore from cloud
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={keepDevice}
              >
                Keep this device
              </button>
            </div>
          </div>
        ) : null}

        {phase === 'restoring' && progress ? (
          <div className="cloud-save-progress" aria-live="polite">
            <div className="cloud-save-progress-header">
              <LoaderCircle size={16} className="cloud-save-spinner" aria-hidden="true" />
              <span>{progress.message}</span>
            </div>
            {progressPercent !== null ? (
              <div className="cloud-save-progress-bar" aria-hidden="true">
                <div
                  className="cloud-save-progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {phase === 'done' && result ? (
          <div className="cloud-save-success" role="status">
            Restored {result.folderCount} folders and {result.artworkCount} artworks from cloud.
            {result.failedImageCount > 0
              ? ` ${result.failedImageCount} image download${result.failedImageCount === 1 ? '' : 's'} failed — metadata was restored, but some images are missing.`
              : ''}
          </div>
        ) : null}

        {phase === 'done' && result?.failedImageCount > 0 ? (
          <button type="button" className="btn btn--secondary btn--sm" onClick={restoreNow}>
            Retry restore
          </button>
        ) : null}

        {phase === 'error' ? (
          <>
            <div className="form-error" role="alert">
              {error}
            </div>
            <button type="button" className="btn btn--secondary btn--sm" onClick={restoreNow}>
              Retry restore
            </button>
          </>
        ) : null}
      </div>
    </section>
  )
}
