import { Heart, Clock, Folder, MoreHorizontal } from 'lucide-react'
import { formatTime } from '../utils/formatTime'
import { resolveMediumType } from '../utils/constants'
import { getFolderPathLabel } from '../utils/folderTree'
import { useLongPress } from '../hooks/useLongPress'
import ArtworkImage from './ArtworkImage'

export default function ArtworkCard({
  artwork,
  folders = [],
  onClick,
  onOpenActions,
  onDragStart,
  onDragMove,
  onDragEnd,
  isDragging = false,
  isDragSource = false,
}) {
  const folderName = artwork.folderId ? getFolderPathLabel(artwork.folderId, folders) : null

  const { longPressHandlers } = useLongPress({
    onPress: () => onClick?.(artwork),
    onLongPress: () => onDragStart?.(artwork),
    onLongPressMove: (event) => onDragMove?.(artwork, event),
    onLongPressEnd: (event, meta) => {
      if (meta.dragged) {
        onDragEnd?.(artwork, event)
      } else if (meta.showActions) {
        onOpenActions?.(artwork)
      } else {
        onDragEnd?.(artwork, event, { cancelled: true })
      }
    },
    disabled: isDragging && !isDragSource,
  })

  return (
    <div
      className={`artwork-card ${isDragSource ? 'artwork-card--dragging' : ''}`}
      {...longPressHandlers}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick?.(artwork)
        }
        if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
          event.preventDefault()
          onOpenActions?.(artwork)
        }
      }}
      aria-label={`View ${artwork.title}. Long-press or use the menu for more actions.`}
    >
      <div className="artwork-card-image-wrap">
        <ArtworkImage
          artwork={artwork}
          mode="gallery"
          alt=""
          className="artwork-card-image"
          fallbackClassName="artwork-card-placeholder"
          loading="lazy"
          iconSize={28}
        />
        {artwork.favorite && (
          <span className="artwork-card-favorite" aria-hidden="true">
            <Heart size={14} fill="currentColor" />
          </span>
        )}
      </div>
      <div className="artwork-card-body">
        <div className="artwork-card-title-row">
          <h3 className="artwork-card-title">{artwork.title}</h3>
          <button
            type="button"
            className="icon-btn artwork-card-menu-btn"
            aria-label={`Actions for ${artwork.title}`}
            onClick={(event) => {
              event.stopPropagation()
              onOpenActions?.(artwork)
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
        <div className="artwork-card-meta">
          <span className="badge badge--medium-type">{resolveMediumType(artwork)}</span>
          {artwork.status && (
            <span
              className={`badge badge--status badge--${artwork.status === 'Finished' ? 'finished' : 'progress'}`}
            >
              {artwork.status}
            </span>
          )}
        </div>
        <div className="artwork-card-details">
          {artwork.medium && (
            <span className="artwork-card-detail">{artwork.medium}</span>
          )}
          {folderName && (
            <span className="artwork-card-detail artwork-card-folder">
              <Folder size={12} aria-hidden="true" />
              {folderName}
            </span>
          )}
          {(artwork.totalMinutes > 0) && (
            <span className="artwork-card-time">
              <Clock size={12} aria-hidden="true" />
              {formatTime(artwork.totalMinutes)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
