import { useEffect, useMemo, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import {
  MEDIUM_TYPES,
  MEDIUM_SUGGESTIONS,
  STATUSES,
  resolveMediumType,
} from '../utils/constants'
import { calculateTotalMinutes } from '../utils/formatTime'
import { getFolderPickerOptions } from '../utils/folderTree'
import { isAcceptedImportFile, normalizeArtworkImage } from '../utils/imageNormalize'
import { formatUserError } from '../utils/userErrors'
import ArtworkImage from './ArtworkImage'
import SegmentedControl from './SegmentedControl'
import FolderSelect from './FolderSelect'

function WorksheetSection({ index, title, tone = '', children }) {
  return (
    <section className={`worksheet-section ${tone ? `worksheet-section--${tone}` : ''}`}>
      <p className="worksheet-legend">
        <span className="worksheet-legend-index">{index}</span>
        {title}
      </p>
      {children}
    </section>
  )
}

export default function ArtworkForm({
  artwork,
  folders = [],
  defaultFolderId = null,
  onSave,
  onCancel,
  saving,
}) {
  const isEditing = Boolean(artwork)

  const [title, setTitle] = useState(artwork?.title || '')
  const [mediumType, setMediumType] = useState(
    artwork ? resolveMediumType(artwork) : 'Digital',
  )
  const [medium, setMedium] = useState(artwork?.medium || '')
  const [folderId, setFolderId] = useState(
    artwork?.folderId ?? defaultFolderId ?? '',
  )
  const [hours, setHours] = useState(artwork?.hours ?? '')
  const [minutes, setMinutes] = useState(artwork?.minutes ?? '')
  const [durationUnknown, setDurationUnknown] = useState(() => {
    if (!artwork) return false
    if (artwork.durationUnknown === true) return true
    return (
      artwork.hours == null && artwork.minutes == null && artwork.totalMinutes == null
    )
  })
  const [status, setStatus] = useState(artwork?.status || 'In Progress')
  const [artworkDate, setArtworkDate] = useState(artwork?.artworkDate || '')
  const [notes, setNotes] = useState(artwork?.notes || '')
  const [imageFile, setImageFile] = useState(null)
  const [error, setError] = useState('')

  const newImagePreview = useMemo(() => {
    if (!imageFile) return null
    return URL.createObjectURL(imageFile)
  }, [imageFile])

  const folderOptions = useMemo(() => getFolderPickerOptions(folders), [folders])

  useEffect(() => {
    return () => {
      if (newImagePreview) URL.revokeObjectURL(newImagePreview)
    }
  }, [newImagePreview])

  const existingImageBlobs = isEditing ? artwork : null

  async function handleImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!isAcceptedImportFile(file)) {
      setError('Please select an image file your browser can open.')
      return
    }

    setError('')
    try {
      const normalized = await normalizeArtworkImage(file)
      setImageFile(normalized.original)
    } catch (err) {
      setImageFile(null)
      setError(
        formatUserError(
          err,
          'Could not process this image. Try JPEG, PNG, or WebP.',
        ),
      )
    }
  }

  function handleHoursChange(e) {
    const val = e.target.value
    if (val === '' || (Number(val) >= 0 && Number.isInteger(Number(val)))) {
      setHours(val)
    }
  }

  function handleMinutesChange(e) {
    const val = e.target.value
    if (val === '') {
      setMinutes(val)
      return
    }
    const num = Number(val)
    if (num >= 0 && num <= 59 && Number.isInteger(num)) {
      setMinutes(val)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!title.trim()) {
      setError('Title is required.')
      return
    }

    if (!isEditing && !imageFile) {
      setError('An artwork image is required.')
      return
    }

    const data = {
      title: title.trim(),
      mediumType,
      medium: medium.trim(),
      folderId: folderId || null,
      durationUnknown,
      hours: durationUnknown ? null : hours === '' ? 0 : Number(hours),
      minutes: durationUnknown ? null : minutes === '' ? 0 : Number(minutes),
      status,
      artworkDate: artworkDate || null,
      notes,
      totalMinutes: durationUnknown
        ? null
        : calculateTotalMinutes(
            hours === '' ? 0 : hours,
            minutes === '' ? 0 : minutes,
          ),
    }

    try {
      await onSave(data, imageFile)
    } catch (err) {
      setError(err.message || 'Failed to save artwork.')
    }
  }

  return (
    <form className="artwork-form" onSubmit={handleSubmit} noValidate>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      <WorksheetSection index="01" title="Artwork" tone="mount">
        <div className="form-group">
          <label htmlFor="artwork-image" className="form-label form-label--required">
            Artwork image
          </label>
          <div className="image-upload">
            {newImagePreview ? (
              <div className="image-preview-wrap">
                <img
                  src={newImagePreview}
                  alt="Preview"
                  className="image-preview"
                />
                <label htmlFor="artwork-image" className="image-change-btn">
                  Change image
                </label>
              </div>
            ) : isEditing && existingImageBlobs ? (
              <div className="image-preview-wrap">
                <ArtworkImage
                  artwork={existingImageBlobs}
                  mode="detail"
                  alt="Preview"
                  className="image-preview"
                  fallbackClassName="image-preview image-preview--fallback"
                  iconSize={32}
                />
                <label htmlFor="artwork-image" className="image-change-btn">
                  Change image
                </label>
              </div>
            ) : (
              <label htmlFor="artwork-image" className="image-upload-area">
                <ImagePlus size={32} strokeWidth={1.5} />
                <span>Tap to mount an image</span>
              </label>
            )}
            <input
              id="artwork-image"
              type="file"
              accept="image/*,.heic,.heif"
              onChange={handleImageChange}
              className="sr-only"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="artwork-title" className="form-label form-label--required">
            Title
          </label>
          <input
            id="artwork-title"
            type="text"
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give your artwork a name"
            required
          />
        </div>
      </WorksheetSection>

      <WorksheetSection index="02" title="Classification">
        <SegmentedControl
          label="Medium type"
          labelId="medium-type-label"
          options={MEDIUM_TYPES}
          value={mediumType}
          onChange={setMediumType}
          columns={3}
          required
        />

        <div className="form-group">
          <label htmlFor="artwork-medium" className="form-label">
            Medium
          </label>
          <input
            id="artwork-medium"
            type="text"
            className="form-input"
            list="medium-suggestions"
            value={medium}
            onChange={(e) => setMedium(e.target.value)}
            placeholder="e.g. Pencil, Procreate, Watercolor"
          />
          <datalist id="medium-suggestions">
            {MEDIUM_SUGGESTIONS.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </div>

        <SegmentedControl
          label="Status"
          labelId="artwork-status-label"
          options={STATUSES}
          value={status}
          onChange={setStatus}
          columns={2}
        />

        <FolderSelect
          folders={folderOptions}
          value={folderId || ''}
          onChange={setFolderId}
        />
      </WorksheetSection>

      <WorksheetSection index="03" title="Time">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="artwork-hours" className="form-label">
              Hours
            </label>
            <input
              id="artwork-hours"
              type="number"
              className="form-input"
              value={durationUnknown ? '' : hours}
              onChange={handleHoursChange}
              min="0"
              placeholder="0"
              disabled={durationUnknown}
            />
          </div>

          <div className="form-group">
            <label htmlFor="artwork-minutes" className="form-label">
              Minutes
            </label>
            <input
              id="artwork-minutes"
              type="number"
              className="form-input"
              value={durationUnknown ? '' : minutes}
              onChange={handleMinutesChange}
              min="0"
              max="59"
              placeholder="0"
              disabled={durationUnknown}
            />
          </div>
        </div>
        <label className="form-check">
          <input
            id="artwork-duration-unknown"
            type="checkbox"
            className="form-checkbox"
            checked={durationUnknown}
            onChange={(event) => {
              const checked = event.target.checked
              setDurationUnknown(checked)
              if (checked) {
                setHours('')
                setMinutes('')
              }
            }}
          />
          <span className="form-check-label">Not sure how long this took</span>
        </label>
      </WorksheetSection>

      <WorksheetSection index="04" title="Details">
        <div className="form-group">
          <label htmlFor="artwork-date" className="form-label">
            Artwork date
          </label>
          <input
            id="artwork-date"
            type="date"
            className="form-input"
            value={artworkDate}
            onChange={(e) => setArtworkDate(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="artwork-notes" className="form-label">
            Notes
          </label>
          <textarea
            id="artwork-notes"
            className="form-textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Thoughts, techniques, or progress notes..."
            rows={3}
          />
        </div>
      </WorksheetSection>

      <div className="form-actions">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button type="submit" className="btn btn--action" disabled={saving}>
          {saving ? 'Saving...' : isEditing ? 'Save changes' : 'Add artwork'}
        </button>
      </div>
    </form>
  )
}
