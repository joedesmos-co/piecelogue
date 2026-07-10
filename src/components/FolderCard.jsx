import { useEffect, useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'
import ArtworkImage from './ArtworkImage'
import { useLongPress } from '../hooks/useLongPress'

export default function FolderCard({
  folder,
  onOpen,
  onRename,
  onDelete,
  onNewSubfolder,
  onMoveFolder,
  isDropTarget = false,
  dropTargetActive = false,
  onDropArtwork,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const { longPressHandlers } = useLongPress({
    onPress: () => onOpen(folder.id),
    onLongPressEnd: (_event, meta) => {
      if (meta.showActions) {
        setMenuOpen(true)
      }
    },
  })

  useEffect(() => {
    if (!menuOpen) return undefined

    function handlePointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  return (
    <article
      className={`folder-card ${isDropTarget ? 'folder-card--drop-target' : ''} ${dropTargetActive ? 'folder-card--drop-active' : ''}`}
      data-folder-id={folder.id}
      onPointerUp={(event) => {
        if (dropTargetActive) {
          onDropArtwork?.(folder.id, event)
        }
      }}
    >
      <div
        className="folder-card-open"
        {...longPressHandlers}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onOpen(folder.id)
          }
        }}
        aria-label={`Open folder ${folder.name}, ${folder.count} artwork${folder.count !== 1 ? 's' : ''}`}
      >
        <div className="folder-card-previews" aria-hidden="true">
          {folder.previews?.length > 0 ? (
            folder.previews.map((previewBlobs, index) => (
              <div key={index} className="folder-card-preview">
                <ArtworkImage
                  blobs={previewBlobs}
                  alt=""
                  className="folder-card-preview-image"
                  fallbackClassName="folder-card-preview-empty"
                  iconSize={16}
                />
              </div>
            ))
          ) : (
            <div className="folder-card-preview folder-card-preview--empty">
              <span>Empty</span>
            </div>
          )}
        </div>
        <div className="folder-card-body">
          <h3 className="folder-card-title">{folder.name}</h3>
          <p className="folder-card-count">
            {folder.count} artwork{folder.count !== 1 ? 's' : ''}
            {folder.childCount > 0
              ? ` · ${folder.childCount} subfolder${folder.childCount !== 1 ? 's' : ''}`
              : ''}
          </p>
        </div>
      </div>

      <div className="folder-card-actions" ref={menuRef}>
        <button
          type="button"
          className="icon-btn folder-card-menu-btn"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={`Folder actions for ${folder.name}`}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <MoreVertical size={18} />
        </button>

        {menuOpen && (
          <div className="folder-menu" role="menu">
            <button
              type="button"
              className="folder-menu-item"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                onNewSubfolder?.(folder)
              }}
            >
              New subfolder
            </button>
            <button
              type="button"
              className="folder-menu-item"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                onRename(folder)
              }}
            >
              Rename
            </button>
            <button
              type="button"
              className="folder-menu-item"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                onMoveFolder?.(folder)
              }}
            >
              Move folder
            </button>
            <button
              type="button"
              className="folder-menu-item folder-menu-item--danger"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                onDelete(folder)
              }}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </article>
  )
}
