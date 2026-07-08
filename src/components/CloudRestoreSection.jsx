import { CloudDownload, LoaderCircle } from 'lucide-react'
import { useRestore } from '../hooks/useRestore'

export default function CloudRestoreSection({ authenticated }) {
  const { restoreState, promptVisible, restoreNow, keepDevice } = useRestore()

  if (!authenticated) {
    return null
  }

  const { phase, progress, result, error } = restoreState
  const isRestoring = phase === 'restoring'
  const isChecking = phase === 'checking'
  const showActiveState =
    promptVisible || isChecking || isRestoring || phase === 'done' || phase === 'error'

  const progressPercent =
    progress?.total > 0 ? Math.round((progress.current / progress.total) * 100) : null

  return (
    <section className="settings-section" aria-labelledby="cloud-restore-heading">
      <h3 id="cloud-restore-heading" className="settings-section-title">
        <CloudDownload size={18} />
        Restore from Cloud
      </h3>

      <div className="settings-card">
        <p className="settings-text settings-text--muted">
          Download your cloud library to this device. If this device already has artwork, you will
          be asked before anything is replaced.
        </p>

        {isChecking ? (
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
              <button type="button" className="btn btn--primary btn--sm" onClick={restoreNow}>
                Restore from cloud
              </button>
              <button type="button" className="btn btn--secondary btn--sm" onClick={keepDevice}>
                Keep this device
              </button>
            </div>
          </div>
        ) : !showActiveState ? (
          <button type="button" className="btn btn--secondary btn--sm" onClick={restoreNow}>
            Restore from cloud
          </button>
        ) : null}

        {isRestoring && progress ? (
          <div className="cloud-save-progress" aria-live="polite" role="status">
            <div className="cloud-save-progress-header">
              <LoaderCircle size={16} className="cloud-save-spinner" aria-hidden="true" />
              <span>{progress.message}</span>
            </div>
            {progressPercent !== null ? (
              <div
                className="cloud-save-progress-bar"
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
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
