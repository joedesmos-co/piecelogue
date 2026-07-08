import { useState } from 'react'
import Modal from './Modal'

export default function DeleteFolderDialog({
  isOpen,
  onClose,
  onConfirm,
  folder,
  busy = false,
}) {
  const [moveContentsTo, setMoveContentsTo] = useState('parent')
  const hasParent = Boolean(folder?.parentFolderId)

  async function handleSubmit(event) {
    event.preventDefault()
    await onConfirm({ moveContentsTo: hasParent ? moveContentsTo : 'root' })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Folder" className="modal--small">
      {isOpen && folder ? (
        <form onSubmit={handleSubmit} className="delete-folder-form">
          <p className="settings-text">
            Delete &ldquo;{folder.name}&rdquo;? Artwork in this folder will not be deleted.
          </p>

          {hasParent ? (
            <fieldset className="delete-folder-options">
              <legend className="form-label">Move folder contents to</legend>
              <label className="delete-folder-option">
                <input
                  type="radio"
                  name="moveContentsTo"
                  value="parent"
                  checked={moveContentsTo === 'parent'}
                  onChange={() => setMoveContentsTo('parent')}
                  disabled={busy}
                />
                <span>Parent folder</span>
              </label>
              <label className="delete-folder-option">
                <input
                  type="radio"
                  name="moveContentsTo"
                  value="root"
                  checked={moveContentsTo === 'root'}
                  onChange={() => setMoveContentsTo('root')}
                  disabled={busy}
                />
                <span>Gallery (top level)</span>
              </label>
            </fieldset>
          ) : (
            <p className="settings-text settings-text--muted">
              Subfolders and artwork in this folder will move to the Gallery (top level).
            </p>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn--danger" disabled={busy}>
              {busy ? 'Deleting...' : 'Delete Folder'}
            </button>
          </div>
        </form>
      ) : null}
    </Modal>
  )
}
