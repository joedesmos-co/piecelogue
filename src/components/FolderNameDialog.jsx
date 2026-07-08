import { useRef, useState } from 'react'
import Modal from './Modal'

function FolderNameForm({
  onClose,
  onSubmit,
  initialName = '',
  submitLabel = 'Save',
  saving = false,
}) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    try {
      await onSubmit(name)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to save folder.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="folder-name-form">
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="folder-name" className="form-label form-label--required">
          Folder name
        </label>
        <input
          ref={inputRef}
          id="folder-name"
          type="text"
          className="form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sketchbook 2026"
          required
          autoFocus
        />
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
          {saving ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )
}

export default function FolderNameDialog({
  isOpen,
  onClose,
  onSubmit,
  title,
  initialName = '',
  submitLabel = 'Save',
  saving = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} className="modal--small">
      {isOpen ? (
        <FolderNameForm
          key={`${title}-${initialName}`}
          initialName={initialName}
          onClose={onClose}
          onSubmit={onSubmit}
          submitLabel={submitLabel}
          saving={saving}
        />
      ) : null}
    </Modal>
  )
}
