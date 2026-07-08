import Modal from './Modal'

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Delete',
  confirmVariant = 'danger',
  busy = false,
}) {
  function handleClose() {
    if (!busy) onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} className="modal--small">
      <p className="confirm-message">{message}</p>
      <div className="form-actions">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={handleClose}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          className={`btn btn--${confirmVariant}`}
          onClick={onConfirm}
          disabled={busy}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
