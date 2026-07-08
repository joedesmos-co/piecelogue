import { useState } from 'react'
import { HardDrive, Sun, Download, Info, LoaderCircle } from 'lucide-react'
import { APP_NAME, APP_TAGLINE, APP_VERSION } from '../utils/constants'
import { downloadLocalBackup } from '../utils/localBackup'
import { formatUserError } from '../utils/userErrors'

export default function SettingsPage() {
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [exportResult, setExportResult] = useState(null)

  async function handleExport() {
    setExporting(true)
    setExportError('')
    setExportResult(null)

    try {
      const result = await downloadLocalBackup()
      setExportResult(result)
    } catch (error) {
      setExportError(formatUserError(error, 'Failed to export backup. Please try again.'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="page settings-page">
      <header className="page-header">
        <h2 className="page-title">Settings</h2>
        <p className="page-subtitle">App preferences and information</p>
      </header>

      <section className="settings-section">
        <h3 className="settings-section-title">
          <Sun size={18} />
          Appearance
        </h3>
        <div className="settings-card">
          <p className="settings-text">
            Piecelogue follows your system light or dark mode preference automatically.
          </p>
        </div>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">
          <HardDrive size={18} />
          Data Storage
        </h3>
        <div className="settings-card">
          <p className="settings-text">
            This version of {APP_NAME} stores your artwork and data locally on this browser and
            device. Images and records live in IndexedDB and remain available after refreshing the
            page.
          </p>
          <p className="settings-text settings-text--muted">
            Sign in to sync your library to your Piecelogue account. Cloud sync uploads changes in
            the background while you work.
          </p>
          <div className="settings-warning" role="note">
            <Info size={16} aria-hidden="true" />
            <p>
              Clearing browser data or using private browsing may remove local artwork. Export a
              backup below for extra safety.
            </p>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">
          <Download size={18} />
          Backup &amp; Export
        </h3>
        <div className="settings-card">
          <p className="settings-text">
            Download a JSON backup of your local folders, artwork metadata, and images from this
            device.
          </p>
          <p className="settings-text settings-text--muted">
            Backups are stored on your device only. Import is not available yet.
          </p>

          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={handleExport}
            disabled={exporting}
            aria-busy={exporting}
          >
            {exporting ? (
              <>
                <LoaderCircle size={14} className="cloud-save-spinner" aria-hidden="true" />
                Exporting...
              </>
            ) : (
              <>
                <Download size={14} aria-hidden="true" />
                Export local backup
              </>
            )}
          </button>

          {exportError ? (
            <div className="form-error" role="alert">
              {exportError}
            </div>
          ) : null}

          {exportResult ? (
            <div className="cloud-save-success" role="status">
              Exported {exportResult.folderCount} folders and {exportResult.artworkCount} artworks.
            </div>
          ) : null}
        </div>
      </section>

      <section className="settings-section settings-about">
        <div className="settings-about-brand">
          <span className="settings-about-name">{APP_NAME}</span>
          <span className="settings-about-tagline">{APP_TAGLINE}</span>
        </div>
        <p className="settings-version">Version {APP_VERSION}</p>
      </section>
    </div>
  )
}
