import { useEffect, useMemo, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import {
  MEDIUM_TYPES,
  MEDIUM_SUGGESTIONS,
  STATUSES,
  resolveMediumType,
} from '../utils/constants'
import { calculateTotalMinutes } from '../utils/formatTime'
import { getFullImageBlobs, isValidImageFile } from '../utils/imageUtils'
import ArtworkImage from './ArtworkImage'
import SegmentedControl from './SegmentedControl'
import FolderSelect from './FolderSelect'

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
  const [status, setStatus] = useState(artwork?.status || 'In Progress')
  const [artworkDate, setArtworkDate] = useState(artwork?.artworkDate || '')
  const [notes, setNotes] = useState(artwork?.notes || '')
  const [imageFile, setImageFile] = useState(null)
  const [error, setError] = useState('')

  const newImagePreview = useMemo(() => {
    if (!imageFile) return null
    return URL.createObjectURL(imageFile)
  }, [imageFile])

  useEffect(() => {
    return () => {
      if (newImagePreview) URL.revokeObjectURL(newImagePreview)
    }
  }, [newImagePreview])

  const existingImageBlobs = isEditing ? getFullImageBlobs(artwork) : []

  function handleImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!isValidImageFile(file)) {
      setError('Please select a valid image file (JPEG, PNG, WebP, or GIF).')
      return
    }

    setError('')
    setImageFile(file)
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
      hours: hours === '' ? 0 : Number(hours),
      minutes: minutes === '' ? 0 : Number(minutes),
      status,
      artworkDate: artworkDate || null,
      notes,
      totalMinutes: calculateTotalMinutes(
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

      <div className="form-group">
        <label htmlFor="artwork-image" className="form-label form-label--required">
          Artwork Image
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
          ) : isEditing && existingImageBlobs.length > 0 ? (
            <div className="image-preview-wrap">
              <ArtworkImage
                blobs={existingImageBlobs}
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
              <span>Tap to add image</span>
            </label>
          )}
          <input
            id="artwork-image"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
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

      <SegmentedControl
        label="Medium Type"
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

      <FolderSelect
        folders={folders}
        value={folderId || ''}
        onChange={setFolderId}
      />

      <div className="form-row form-row--three form-row--time">
        <div className="form-group">
          <label htmlFor="artwork-hours" className="form-label">
            Hours
          </label>
          <input
            id="artwork-hours"
            type="number"
            className="form-input"
            value={hours}
            onChange={handleHoursChange}
            min="0"
            placeholder="0"
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
            value={minutes}
            onChange={handleMinutesChange}
            min="0"
            max="59"
            placeholder="0"
          />
        </div>

        <SegmentedControl
          label="Status"
          labelId="artwork-status-label"
          options={STATUSES}
          value={status}
          onChange={setStatus}
          columns={2}
          compact
        />
      </div>

      <div className="form-group">
        <label htmlFor="artwork-date" className="form-label">
          Artwork Date
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

      <div className="form-actions">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Artwork'}
        </button>
      </div>
    </form>
  )
}
