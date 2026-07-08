import { useRef, useState } from 'react'
import Modal from './Modal'

function UsernameForm({ initialUsername = '', onClose, onSubmit, saving = false }) {
  const [username, setUsername] = useState(initialUsername)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    try {
      await onSubmit(username)
      onClose()
    } catch (err) {
      setError(err.message || 'Unable to save username.')
    }
  }

  const preview = username.trim()
    ? `@${username.trim().replace(/^@+/, '').toLowerCase()}`
    : '@username'

  return (
    <form onSubmit={handleSubmit} className="username-form">
      {error ? (
        <div className="form-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="form-group">
        <label htmlFor="profile-username" className="form-label form-label--required">
          Username
        </label>
        <input
          ref={inputRef}
          id="profile-username"
          type="text"
          className="form-input"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="ryland"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          autoFocus
        />
        <p className="form-hint">Your handle will appear as {preview}</p>
        <p className="form-hint">
          3–24 characters. Letters, numbers, and underscores only.
        </p>
      </div>

      <div className="form-actions">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save username'}
        </button>
      </div>
    </form>
  )
}

export default function UsernameDialog({
  isOpen,
  onClose,
  onSubmit,
  initialUsername = '',
  title = 'Choose username',
  saving = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      closeOnBackdrop={!saving}
      title={title}
      className="modal--small"
    >
      {isOpen ? (
        <UsernameForm
          key={`${title}-${initialUsername}`}
          initialUsername={initialUsername}
          onClose={onClose}
          onSubmit={onSubmit}
          saving={saving}
        />
      ) : null}
    </Modal>
  )
}
