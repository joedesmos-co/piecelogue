import { useCallback, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useObjectUrl } from '../hooks/useObjectUrl'
import ArtworkImage from './ArtworkImage'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function ImageLightbox({ blob, title, isOpen, onClose, triggerRef }) {
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  const imageUrl = useObjectUrl(blob)

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = Array.from(
        dialogRef.current.querySelectorAll(FOCUSABLE),
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    },
    [onClose],
  )

  useEffect(() => {
    if (!isOpen) return undefined

    const previousOverflow = document.body.style.overflow
    const trigger = triggerRef?.current
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      trigger?.focus()
    }
  }, [isOpen, handleKeyDown, triggerRef])

  if (!isOpen) return null

  return (
    <div
      className="lightbox-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="lightbox"
        role="dialog"
        aria-modal="true"
        aria-label={title ? `Full screen view of ${title}` : 'Full screen artwork view'}
        onClick={onClose}
      >
        <header className="lightbox-header">
          {title ? <h2 className="lightbox-title">{title}</h2> : <span />}
          <button
            ref={closeButtonRef}
            type="button"
            className="lightbox-close icon-btn"
            onClick={onClose}
            aria-label="Close full screen view"
          >
            <X size={22} />
          </button>
        </header>

        <div className="lightbox-body">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title || 'Artwork'}
              className="lightbox-image"
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <div
              className="lightbox-image-fallback"
              onClick={(event) => event.stopPropagation()}
            >
              <ArtworkImage blob={blob} alt={title} iconSize={40} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
