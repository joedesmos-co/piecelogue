import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  DELETE_ACCOUNT_CONFIRMATION,
  DELETE_CLOUD_DATA_CONFIRMATION,
} from '../constants/accountControls'
import { deleteAccount, deleteCloudData } from '../api/account'
import { useAuth } from '../hooks/useAuth'
import { formatUserError } from '../utils/userErrors'

function ConfirmationField({ id, label, value, onChange, placeholder, disabled }) {
  return (
    <label className="account-danger-field" htmlFor={id}>
      <span className="settings-text">{label}</span>
      <input
        id={id}
        className="form-input"
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
      />
    </label>
  )
}

export default function AccountDataControlsSection({ authenticated }) {
  const { signOut } = useAuth()
  const [cloudConfirm, setCloudConfirm] = useState('')
  const [accountConfirm, setAccountConfirm] = useState('')
  const [showCloudDelete, setShowCloudDelete] = useState(false)
  const [showAccountDelete, setShowAccountDelete] = useState(false)
  const [deletingCloud, setDeletingCloud] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [cloudError, setCloudError] = useState('')
  const [accountError, setAccountError] = useState('')
  const [cloudResult, setCloudResult] = useState(null)

  if (!authenticated) {
    return null
  }

  async function handleDeleteCloudData() {
    setCloudError('')
    setCloudResult(null)
    setDeletingCloud(true)

    try {
      const result = await deleteCloudData(cloudConfirm.trim())
      setCloudResult(result)
      setCloudConfirm('')
      setShowCloudDelete(false)
    } catch (err) {
      setCloudError(formatUserError(err, 'Could not delete cloud data.'))
    } finally {
      setDeletingCloud(false)
    }
  }

  async function handleDeleteAccount() {
    setAccountError('')
    setDeletingAccount(true)

    try {
      await deleteAccount(accountConfirm.trim())
      setAccountConfirm('')
      setShowAccountDelete(false)
      await signOut()
    } catch (err) {
      setAccountError(formatUserError(err, 'Could not delete account.'))
    } finally {
      setDeletingAccount(false)
    }
  }

  const cloudConfirmationReady = cloudConfirm.trim() === DELETE_CLOUD_DATA_CONFIRMATION
  const accountConfirmationReady = accountConfirm.trim() === DELETE_ACCOUNT_CONFIRMATION

  return (
    <section className="settings-section" aria-labelledby="account-data-controls-heading">
      <h3 id="account-data-controls-heading" className="settings-section-title">
        <AlertTriangle size={18} />
        Data controls
      </h3>

      <div className="settings-card">
        <p className="settings-text settings-text--muted">
          These actions affect your Piecelogue account and cloud backup. Your local library on this
          device is not changed unless you delete items here in the app.
        </p>

        <div className="account-danger-block">
          <h4 className="account-danger-title">Delete all cloud data</h4>
          <p className="settings-text settings-text--muted">
            Permanently removes your cloud folders, artwork metadata, and images. Your account
            stays signed in and local data on this device is kept.
          </p>

          {showCloudDelete ? (
            <div className="account-danger-panel" role="note">
              <p className="settings-text account-danger-warning">
                This cannot be undone. Cloud restore will be empty until you sync again from this
                device or another one.
              </p>
              <ConfirmationField
                id="delete-cloud-confirmation"
                label={`Type ${DELETE_CLOUD_DATA_CONFIRMATION} to confirm`}
                value={cloudConfirm}
                onChange={setCloudConfirm}
                placeholder={DELETE_CLOUD_DATA_CONFIRMATION}
                disabled={deletingCloud}
              />
              <div className="account-actions">
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  onClick={handleDeleteCloudData}
                  disabled={deletingCloud || !cloudConfirmationReady}
                >
                  {deletingCloud ? 'Deleting cloud data...' : 'Delete cloud data'}
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => {
                    setShowCloudDelete(false)
                    setCloudConfirm('')
                    setCloudError('')
                  }}
                  disabled={deletingCloud}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn--ghost btn--sm account-danger-trigger"
              onClick={() => setShowCloudDelete(true)}
            >
              Delete all cloud data
            </button>
          )}

          {cloudError ? (
            <div className="alert alert--error" role="alert">
              {cloudError}
            </div>
          ) : null}

          {cloudResult ? (
            <div className="cloud-save-success" role="status">
              Cloud data deleted. Removed {cloudResult.foldersTombstoned ?? 0} folders and{' '}
              {cloudResult.artworksTombstoned ?? 0} artworks from your account backup.
            </div>
          ) : null}
        </div>

        <div className="account-danger-block account-danger-block--account">
          <h4 className="account-danger-title">Delete account</h4>
          <p className="settings-text settings-text--muted">
            Permanently deletes your Piecelogue account, cloud library, sessions, and username. You
            can register again later with the same email, but your cloud data will be gone.
          </p>

          {showAccountDelete ? (
            <div className="account-danger-panel account-danger-panel--critical" role="note">
              <p className="settings-text account-danger-warning">
                This permanently deletes your account and all cloud backups. Local data on this
                device is not removed automatically.
              </p>
              <ConfirmationField
                id="delete-account-confirmation"
                label={`Type ${DELETE_ACCOUNT_CONFIRMATION} to confirm`}
                value={accountConfirm}
                onChange={setAccountConfirm}
                placeholder={DELETE_ACCOUNT_CONFIRMATION}
                disabled={deletingAccount}
              />
              <div className="account-actions">
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount || !accountConfirmationReady}
                >
                  {deletingAccount ? 'Deleting account...' : 'Delete account permanently'}
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => {
                    setShowAccountDelete(false)
                    setAccountConfirm('')
                    setAccountError('')
                  }}
                  disabled={deletingAccount}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn--ghost btn--sm account-danger-trigger"
              onClick={() => setShowAccountDelete(true)}
            >
              Delete account
            </button>
          )}

          {accountError ? (
            <div className="alert alert--error" role="alert">
              {accountError}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
