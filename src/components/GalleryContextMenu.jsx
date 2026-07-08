import { useEffect, useRef } from 'react'

export default function GalleryContextMenu({ isOpen, x, y, onClose, onNewFolder }) {
  const menuRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined

    function handlePointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose()
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={menuRef}
      className="gallery-context-menu"
      style={{ top: y, left: x }}
      role="menu"
      aria-label="Gallery actions"
    >
      <button
        type="button"
        className="gallery-context-menu-item"
        role="menuitem"
        onClick={() => {
          onClose()
          onNewFolder()
        }}
      >
        New Folder
      </button>
    </div>
  )
}
