import { useRef, useState } from 'react'
import {
  ArrowLeft,
  Edit,
  Star,
  Trash2,
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
import { CatalogMeta, PaperPanel, PrintFrame, TapeStrip } from './StudioKit'

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
          <ArrowLeft size={18} aria-hidden="true" />
          Back to Gallery
        </button>
      </header>

      <div className="detail-content">
        <div className="detail-image-wrap">
          <PrintFrame label="Mounted print">
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
          </PrintFrame>

          {imageUnavailable ? (
            <PaperPanel tone="charcoal" className="detail-repair-sheet" style={{ padding: '18px' }}>
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
            </PaperPanel>
          ) : null}
        </div>

        <div className="detail-info">
          <PaperPanel className="detail-placard">
            <div className="detail-placard-top">
              <div>
                <p className="studio-label studio-label--muted">Catalog record</p>
                <h1 className="detail-title">{artwork.title}</h1>
              </div>
              <button
                type="button"
                className={`icon-btn detail-favorite ${artwork.favorite ? 'icon-btn--active' : ''}`}
                onClick={() => onToggleFavorite(artwork)}
                aria-label={artwork.favorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star size={20} fill={artwork.favorite ? 'currentColor' : 'none'} />
              </button>
            </div>

            <div className="detail-badges">
              <span
                className={`badge badge--status badge--${artwork.status === 'Finished' ? 'finished' : 'progress'}`}
              >
                {artwork.status}
              </span>
            </div>

            <CatalogMeta
              items={[
                { label: 'Medium type', value: resolveMediumType(artwork) },
                artwork.medium ? { label: 'Medium', value: artwork.medium } : null,
                folderName ? { label: 'Folder', value: folderName } : null,
                artwork.totalMinutes > 0
                  ? { label: 'Time spent', value: formatTime(artwork.totalMinutes) }
                  : null,
                formattedDate ? { label: 'Artwork date', value: formattedDate } : null,
              ]}
            />

            <div className="detail-actions">
              <button type="button" className="btn btn--primary" onClick={() => onEdit(artwork)}>
                <Edit size={18} aria-hidden="true" />
                Edit artwork
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => onDelete(artwork)}
              >
                <Trash2 size={18} aria-hidden="true" />
                Delete
              </button>
            </div>
          </PaperPanel>

          {artwork.notes ? (
            <div className="detail-note-sheet studio-panel">
              <TapeStrip angle={-6} />
              <p className="detail-note-kicker">Studio note</p>
              <p className="detail-note-text">{artwork.notes}</p>
            </div>
          ) : null}
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
