import Modal from './Modal'

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Delete',
  confirmVariant = 'danger',
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} className="modal--small">
      <p className="confirm-message">{message}</p>
      <div className="form-actions">
        <button type="button" className="btn btn--secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={`btn btn--${confirmVariant}`}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
