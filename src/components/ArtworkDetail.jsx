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
  ImagePlus,
} from 'lucide-react'
import { formatTime } from '../utils/formatTime'
import { resolveMediumType } from '../utils/constants'
import { getFolderPathLabel } from '../utils/folderTree'
import { isAcceptedImportFile, normalizeArtworkImage } from '../utils/imageNormalize'
import { useArtworkImageSource } from '../hooks/useArtworkImageSource'
import { repairArtworkImage } from '../db/artworkService'
import { formatUserError } from '../utils/userErrors'
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
  onImageRepaired,
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [repairInputKey, setRepairInputKey] = useState(0)
  const [repairError, setRepairError] = useState('')
  const [repairing, setRepairing] = useState(false)
  const imageTriggerRef = useRef(null)
  const { blob: imageBlob, unavailable: imageUnavailable } = useArtworkImageSource(
    artwork,
    'detail',
  )
  const folderName = artwork.folderId ? getFolderPathLabel(artwork.folderId, folders) : null

  const formattedDate = artwork.artworkDate
    ? new Date(artwork.artworkDate + 'T00:00:00').toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  async function handleRepairImage(file) {
    if (!file || !isAcceptedImportFile(file)) {
      setRepairError('Please select an image file your browser can open.')
      return
    }

    setRepairing(true)
    setRepairError('')

    try {
      const normalized = await normalizeArtworkImage(file)
      await repairArtworkImage(artwork.id, normalized.original)
      setRepairInputKey((value) => value + 1)
      onImageRepaired?.()
    } catch (error) {
      setRepairError(formatUserError(error, 'Could not repair artwork image.'))
    } finally {
      setRepairing(false)
    }
  }

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
              artwork={artwork}
              mode="detail"
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
          {imageUnavailable ? (
            <div className="detail-image-repair">
              <p className="settings-text settings-text--muted">
                This image can no longer be read on this device. Re-select the image to repair it.
              </p>
              {repairError ? (
                <div className="alert alert--error" role="alert">
                  {repairError}
                </div>
              ) : null}
              <label className="btn btn--secondary btn--sm">
                <ImagePlus size={14} aria-hidden="true" />
                {repairing ? 'Repairing...' : 'Repair image'}
                <input
                  key={repairInputKey}
                  type="file"
                  accept="image/*,.heic,.heif"
                  hidden
                  disabled={repairing}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) {
                      handleRepairImage(file)
                    }
                  }}
                />
              </label>
            </div>
          ) : null}
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
