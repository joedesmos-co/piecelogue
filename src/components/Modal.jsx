import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children, className = '' }) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className={`modal ${className}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header className="modal-header">
          <h2 id="modal-title" className="modal-title">
            {title}
          </h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
