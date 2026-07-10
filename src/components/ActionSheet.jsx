import { useEffect } from 'react'

export default function ActionSheet({ isOpen, title, onClose, children }) {
  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div className="action-sheet-root" role="presentation">
      <button type="button" className="action-sheet-backdrop" aria-label="Close actions" onClick={onClose} />
      <div className="action-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="action-sheet-handle" aria-hidden="true" />
        {title ? <h3 className="action-sheet-title">{title}</h3> : null}
        <div className="action-sheet-body">{children}</div>
      </div>
    </div>
  )
}

export function ActionSheetButton({ children, onClick, variant = 'default', disabled = false }) {
  return (
    <button
      type="button"
      className={`action-sheet-btn action-sheet-btn--${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
