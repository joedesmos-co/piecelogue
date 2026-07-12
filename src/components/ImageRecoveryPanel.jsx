import { useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { repairArtworkImage } from '../db/artworkService'
import { isValidImageFile } from '../utils/imageUtils'
import { formatUserError } from '../utils/userErrors'
import { wakeSyncProcessor } from '../sync/processor'

export default function ImageRecoveryPanel({ entries = [], onRepaired }) {
  const [activeArtworkId, setActiveArtworkId] = useState(null)
  const [error, setError] = useState('')

  if (!entries.length) {
    return null
  }

  async function handleRepairFile(artworkId, file) {
    if (!file || !isValidImageFile(file)) {
      setError('Please select a valid image file (JPEG, PNG, WebP, or GIF).')
      return
    }

    setActiveArtworkId(artworkId)
    setError('')

    try {
      await repairArtworkImage(artworkId, file)
      wakeSyncProcessor()
      onRepaired?.()
    } catch (err) {
      setError(formatUserError(err, 'Could not repair artwork image.'))
    } finally {
      setActiveArtworkId(null)
    }
  }

  return (
    <div className="sync-recovery-panel" role="region" aria-label="Image repair required">
      <p className="settings-text settings-text--muted">
        These artwork images can no longer be read on this device. Re-select the original image to
        repair them without losing metadata, stats, or folder placement.
      </p>

      {error ? (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      ) : null}

      <ul className="sync-recovery-list">
        {entries.map((entry) => (
          <li key={entry.artworkId} className="sync-recovery-item">
            <div>
              <strong>{entry.title}</strong>
              <p className="settings-text settings-text--muted">
                This image can no longer be read on this device. Re-select the image to repair it.
              </p>
            </div>
            <label className="btn btn--secondary btn--sm">
              <ImagePlus size={14} aria-hidden="true" />
              {activeArtworkId === entry.artworkId ? 'Repairing...' : 'Repair image'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                hidden
                disabled={activeArtworkId === entry.artworkId}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) {
                    handleRepairFile(entry.artworkId, file)
                  }
                }}
              />
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
