import { useRef, useState } from 'react'
import { HardDrive, Sun, Download, Upload, Info, LoaderCircle } from 'lucide-react'
import { APP_NAME, APP_TAGLINE, APP_VERSION } from '../utils/constants'
import {
  downloadLocalBackup,
  importLocalBackup,
  readBackupFile,
} from '../utils/localBackup'
import { formatUserError } from '../utils/userErrors'
import LocalFirstExplainer from '../components/LocalFirstExplainer'
import ConfirmDialog from '../components/ConfirmDialog'

export default function SettingsPage() {
  const fileInputRef = useRef(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [exportResult, setExportResult] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importResult, setImportResult] = useState(null)
  const [pendingImport, setPendingImport] = useState(null)
  const [showImportConfirm, setShowImportConfirm] = useState(false)

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

  async function handleImportFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    setImportError('')
    setImportResult(null)

    try {
      const backup = await readBackupFile(file)
      setPendingImport(backup)
      setShowImportConfirm(true)
    } catch (error) {
      setImportError(formatUserError(error, 'Could not read backup file.'))
    }
  }

  async function handleConfirmImport() {
    if (!pendingImport) {
      return
    }

    setImporting(true)
    setImportError('')

    try {
      const result = await importLocalBackup(pendingImport)
      setImportResult(result)
      setShowImportConfirm(false)
      setPendingImport(null)
      window.location.reload()
    } catch (error) {
      setImportError(formatUserError(error, 'Failed to import backup.'))
    } finally {
      setImporting(false)
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
          <Sun size={18} aria-hidden="true" />
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
          <HardDrive size={18} aria-hidden="true" />
          Local-first &amp; cloud sync
        </h3>
        <div className="settings-card">
          <LocalFirstExplainer />
          <div className="settings-warning" role="note">
            <Info size={16} aria-hidden="true" />
            <p>
              Clearing browser data or using private browsing may remove local artwork. Export a
              backup below for extra safety, and sign in on Profile for cloud backup.
            </p>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">
          <Download size={18} aria-hidden="true" />
          Backup &amp; Export
        </h3>
        <div className="settings-card">
          <p className="settings-text">
            Export or import a JSON backup of folders, artwork metadata, and images from this device.
          </p>
          <p className="settings-text settings-text--muted">
            Import merges backup items by ID. Existing records with the same ID are updated.
          </p>

          <div className="account-actions settings-backup-actions">
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={handleExport}
              disabled={exporting || importing}
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

            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={exporting || importing}
              aria-busy={importing}
            >
              {importing ? (
                <>
                  <LoaderCircle size={14} className="cloud-save-spinner" aria-hidden="true" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload size={14} aria-hidden="true" />
                  Import backup
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="visually-hidden"
              onChange={handleImportFile}
              aria-label="Choose backup JSON file"
            />
          </div>

          {exportError ? (
            <div className="form-error" role="alert">
              {exportError}
            </div>
          ) : null}

          {importError ? (
            <div className="form-error" role="alert">
              {importError}
            </div>
          ) : null}

          {exportResult ? (
            <div className="cloud-save-success" role="status">
              Exported {exportResult.folderCount} folders and {exportResult.artworkCount} artworks.
            </div>
          ) : null}

          {importResult ? (
            <div className="cloud-save-success" role="status">
              Imported {importResult.folderCount} folders and {importResult.artworkCount} artworks.
            </div>
          ) : null}
        </div>
      </section>

      <section className="settings-section settings-about">
        <div className="settings-about-brand">
          <span className="settings-about-name">{APP_NAME}</span>
          <span className="settings-about-tagline">{APP_TAGLINE}</span>
        </div>
        <p className="settings-version">Version {APP_VERSION} · Private beta</p>
        <p className="settings-text settings-text--muted">
          Questions or feedback? Visit the Contact page on the Piecelogue website.
        </p>
      </section>

      <ConfirmDialog
        isOpen={showImportConfirm}
        onClose={() => {
          if (!importing) {
            setShowImportConfirm(false)
            setPendingImport(null)
          }
        }}
        onConfirm={handleConfirmImport}
        title="Import backup?"
        message="This merges the backup into your local library on this device. Items with matching IDs will be updated. Cloud sync is not changed automatically."
        confirmLabel={importing ? 'Importing...' : 'Import backup'}
        confirmVariant="primary"
        busy={importing}
      />
    </div>
  )
}
