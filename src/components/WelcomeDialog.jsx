import { Cloud, HardDrive, Images, Plus } from 'lucide-react'
import Modal from './Modal'
import { markOnboardingComplete } from '../utils/onboarding'

export default function WelcomeDialog({ isOpen, onClose, onAddArtwork, onGoToProfile }) {
  function handleGetStarted() {
    markOnboardingComplete()
    onClose()
  }

  function handleAddFirst() {
    markOnboardingComplete()
    onClose()
    onAddArtwork?.()
  }

  function handleLearnSync() {
    markOnboardingComplete()
    onClose()
    onGoToProfile?.()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleGetStarted}
      title="Welcome to Piecelogue"
      className="modal--small welcome-dialog"
    >
      <p className="settings-text settings-text--muted welcome-intro">
        A simple place to log artwork, organize folders, and track your creative time.
      </p>

      <ul className="welcome-steps">
        <li className="welcome-step">
          <span className="welcome-step-icon" aria-hidden="true">
            <HardDrive size={18} />
          </span>
          <div>
            <p className="welcome-step-title">Local-first</p>
            <p className="settings-text settings-text--muted">
              Your library lives on this device first. It stays available after refresh.
            </p>
          </div>
        </li>
        <li className="welcome-step">
          <span className="welcome-step-icon" aria-hidden="true">
            <Images size={18} />
          </span>
          <div>
            <p className="welcome-step-title">Log your work</p>
            <p className="settings-text settings-text--muted">
              Add artwork with images, folders, time spent, and status as you create.
            </p>
          </div>
        </li>
        <li className="welcome-step">
          <span className="welcome-step-icon" aria-hidden="true">
            <Cloud size={18} />
          </span>
          <div>
            <p className="welcome-step-title">Optional cloud sync</p>
            <p className="settings-text settings-text--muted">
              Sign in on Profile to back up and sync across your devices. No sharing, ads, or AI.
            </p>
          </div>
        </li>
      </ul>

      <div className="form-actions welcome-actions">
        <button type="button" className="btn btn--primary" onClick={handleAddFirst}>
          <Plus size={16} aria-hidden="true" />
          Add first artwork
        </button>
        <button type="button" className="btn btn--secondary" onClick={handleLearnSync}>
          Learn about sync
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={handleGetStarted}>
          Skip for now
        </button>
      </div>
    </Modal>
  )
}
