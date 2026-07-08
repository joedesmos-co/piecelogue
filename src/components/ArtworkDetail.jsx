import { useRef, useState } from 'react'
import {
  ArrowLeft,
  Clock,
  Edit,
  Heart,
  Trash2,
  Calendar,
  Tag,
  Layers,
  Maximize2,
} from 'lucide-react'
import { formatTime } from '../utils/formatTime'
import { resolveMediumType } from '../utils/constants'
import { getFullImageBlob, getFullImageBlobs } from '../utils/imageUtils'
import { getFolderName } from '../db/folderService'
import ArtworkImage from './ArtworkImage'
import ImageLightbox from './ImageLightbox'

function DetailRow({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div className="detail-row">
      <Icon size={16} className="detail-row-icon" aria-hidden="true" />
      <span className="detail-row-label">{label}</span>
      <span className="detail-row-value">{value}</span>
    </div>
  )
}

export default function ArtworkDetail({
  artwork,
  folders = [],
  onBack,
  onEdit,
  onDelete,
  onToggleFavorite,
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const imageTriggerRef = useRef(null)
  const imageBlobs = getFullImageBlobs(artwork)
  const imageBlob = getFullImageBlob(artwork)
  const folderName = getFolderName(artwork.folderId, folders)

  const formattedDate = artwork.artworkDate
    ? new Date(artwork.artworkDate + 'T00:00:00').toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <div className="artwork-detail">
      <header className="detail-header">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          <ArrowLeft size={18} />
          Back
        </button>
        <div className="detail-actions">
          <button
            type="button"
            className={`icon-btn ${artwork.favorite ? 'icon-btn--active' : ''}`}
            onClick={() => onToggleFavorite(artwork)}
            aria-label={artwork.favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart size={20} fill={artwork.favorite ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => onEdit(artwork)}
            aria-label="Edit artwork"
          >
            <Edit size={20} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--danger"
            onClick={() => onDelete(artwork)}
            aria-label="Delete artwork"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </header>

      <div className="detail-content">
        <div className="detail-image-wrap">
          <button
            ref={imageTriggerRef}
            type="button"
            className="detail-image-button"
            onClick={() => setLightboxOpen(true)}
            aria-label="View artwork full screen"
            disabled={!imageBlob}
          >
            <ArtworkImage
              blobs={imageBlobs}
              alt={artwork.title}
              className="detail-image"
              fallbackClassName="detail-image-placeholder"
              iconSize={36}
            />
            {imageBlob && (
              <span className="detail-image-expand" aria-hidden="true">
                <Maximize2 size={18} />
              </span>
            )}
          </button>
        </div>

        <div className="detail-info">
          <h1 className="detail-title">{artwork.title}</h1>

          <div className="detail-badges">
            <span
              className={`badge badge--status badge--${artwork.status === 'Finished' ? 'finished' : 'progress'}`}
            >
              {artwork.status}
            </span>
          </div>

          <div className="detail-rows">
            <DetailRow
              icon={Tag}
              label="Medium Type"
              value={resolveMediumType(artwork)}
            />
            {artwork.medium && (
              <DetailRow icon={Tag} label="Medium" value={artwork.medium} />
            )}
            {folderName && (
              <DetailRow icon={Layers} label="Folder" value={folderName} />
            )}
            {artwork.totalMinutes > 0 && (
              <DetailRow
                icon={Clock}
                label="Time spent"
                value={formatTime(artwork.totalMinutes)}
              />
            )}
            {formattedDate && (
              <DetailRow icon={Calendar} label="Artwork date" value={formattedDate} />
            )}
          </div>

          {artwork.notes && (
            <div className="detail-notes">
              <h3 className="detail-notes-title">Notes</h3>
              <p className="detail-notes-text">{artwork.notes}</p>
            </div>
          )}
        </div>
      </div>

      <ImageLightbox
        blob={imageBlob}
        title={artwork.title}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        triggerRef={imageTriggerRef}
      />
    </div>
  )
}
