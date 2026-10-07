import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Edit,
  Star,
  Trash2,
  Maximize2,
  ImagePlus,
} from 'lucide-react'
import { formatTime, UNKNOWN_DURATION_LABEL, isDurationUnknown } from '../utils/formatTime'
import { resolveMediumType } from '../utils/constants'
import { getFolderPathLabel } from '../utils/folderTree'
import { isAcceptedImportFile, normalizeArtworkImage } from '../utils/imageNormalize'
import { useArtworkImageSource } from '../hooks/useArtworkImageSource'
import { repairArtworkImage } from '../db/artworkService'
import { formatUserError } from '../utils/userErrors'
import ArtworkImage from './ArtworkImage'
import ImageLightbox from './ImageLightbox'
import { CatalogMeta, PaperPanel, PrintFrame, TapeStrip } from './StudioKit'
import { isInteractiveTarget, resolveArtworkSwipe } from '../utils/gestures'

export default function ArtworkDetail({
  artwork,
  folders = [],
  onBack,
  onEdit,
  onDelete,
  onToggleFavorite,
  onImageRepaired,
  hasPrevious = false,
  hasNext = false,
  position = null,
  total = null,
  onPrevious,
  onNext,
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [repairInputKey, setRepairInputKey] = useState(0)
  const [repairError, setRepairError] = useState('')
  const [repairing, setRepairing] = useState(false)
  const imageTriggerRef = useRef(null)
  const swipeRef = useRef(null)
  const canSwipe = Boolean(hasPrevious || hasNext)
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

  // Horizontal swipe through the same visible collection (left = next,
  // right = previous). Ignored while zoomed, editing, or using controls.
  function handleDetailTouchStart(event) {
    if (!canSwipe || lightboxOpen || event.touches.length !== 1) {
      swipeRef.current = null
      return
    }
    if (isInteractiveTarget(event.target)) {
      swipeRef.current = null
      return
    }
    const touch = event.touches[0]
    swipeRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
    }
  }

  function handleDetailTouchEnd(event) {
    const start = swipeRef.current
    swipeRef.current = null
    if (!start || !canSwipe || lightboxOpen) return
    const touch = event.changedTouches[0]
    if (!touch) return
    if (isInteractiveTarget(event.target)) return
    const direction = resolveArtworkSwipe({
      startX: start.startX,
      startY: start.startY,
      endX: touch.clientX,
      endY: touch.clientY,
      durationMs: Date.now() - start.startTime,
    })
    if (direction === 'next' && hasNext) onNext?.()
    else if (direction === 'prev' && hasPrevious) onPrevious?.()
  }

  // Desktop: arrow keys move through the collection when focus is not in an
  // input, control, or editable region.
  useEffect(() => {
    if (!canSwipe) return undefined
    function handleKeyDown(event) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      if (lightboxOpen) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        target.closest(
          'input, textarea, select, button, a, [contenteditable], [role="dialog"]',
        )
      ) {
        return
      }
      if (event.key === 'ArrowRight' && hasNext) {
        event.preventDefault()
        onNext?.()
      } else if (event.key === 'ArrowLeft' && hasPrevious) {
        event.preventDefault()
        onPrevious?.()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [canSwipe, hasNext, hasPrevious, lightboxOpen, onNext, onPrevious])

  return (
    <div
      className="artwork-detail"
      onTouchStart={handleDetailTouchStart}
      onTouchEnd={handleDetailTouchEnd}
    >
      <header className="detail-header">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          <ArrowLeft size={18} aria-hidden="true" />
          Back to Gallery
        </button>
        {total != null && position != null ? (
          <div className="detail-nav" role="group" aria-label="Browse artworks">
            <button
              type="button"
              className="icon-btn detail-nav-btn"
              onClick={onPrevious}
              disabled={!hasPrevious}
              aria-label="Previous artwork"
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <span className="detail-nav-count" aria-live="polite">
              {position} of {total}
            </span>
            <button
              type="button"
              className="icon-btn detail-nav-btn"
              onClick={onNext}
              disabled={!hasNext}
              aria-label="Next artwork"
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </div>
        ) : null}
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
                isDurationUnknown(artwork)
                  ? { label: 'Time spent', value: UNKNOWN_DURATION_LABEL }
                  : artwork.totalMinutes > 0
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
