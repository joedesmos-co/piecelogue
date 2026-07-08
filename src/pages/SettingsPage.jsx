import { HardDrive, Sun, Download, Info } from 'lucide-react'
import { APP_NAME, APP_TAGLINE, APP_VERSION } from '../utils/constants'

export default function SettingsPage() {
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
            Piecelogue follows your system light or dark mode preference
            automatically.
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
            This version of {APP_NAME} stores all your artwork and data locally
            on this browser and device. Your images and records are saved in
            IndexedDB and remain available after refreshing the page.
          </p>
          <div className="settings-warning" role="note">
            <Info size={16} aria-hidden="true" />
            <p>
              Clearing your browser data or using private browsing may remove
              your artwork. Keep backups of important images until export is
              available.
            </p>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">
          <Download size={18} />
          Backup &amp; Export
        </h3>
        <div className="settings-card settings-card--placeholder">
          <p className="settings-text settings-text--muted">
            Export and backup features are coming in a future update. You will
            be able to download your artwork and data as a backup file.
          </p>
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
