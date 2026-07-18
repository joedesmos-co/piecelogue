import { useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { repairArtworkImage } from '../db/artworkService'
import { isAcceptedImportFile, normalizeArtworkImage } from '../utils/imageNormalize'
import { formatUserError } from '../utils/userErrors'
import { wakeSyncProcessor } from '../sync/processor'

function recoveryMessage(entry) {
  const reasons = entry.reasons || []
  if (reasons.includes('cloud_incomplete')) {
    return 'This image was never uploaded to cloud. Re-select the original image to repair it, then sync again.'
  }
  return 'This image can no longer be read on this device. Re-select the image to repair it.'
}

export default function ImageRecoveryPanel({ entries = [], onRepaired, title }) {
  const [activeArtworkId, setActiveArtworkId] = useState(null)
  const [error, setError] = useState('')

  if (!entries.length) {
    return null
  }

  async function handleRepairFile(artworkId, file) {
    if (!file || !isAcceptedImportFile(file)) {
      setError('Please select an image file your browser can open.')
      return
    }

    setActiveArtworkId(artworkId)
    setError('')

    try {
      const normalized = await normalizeArtworkImage(file)
      await repairArtworkImage(artworkId, normalized.original)
      wakeSyncProcessor()
      onRepaired?.()
    } catch (err) {
      setError(formatUserError(err, 'Could not repair artwork image.'))
    } finally {
      setActiveArtworkId(null)
    }
  }

  return (
    <div className="sync-recovery-panel" role="region" aria-label={title || 'Image repair required'}>
      <p className="settings-text settings-text--muted">
        {title ||
          'These artwork images need repair. Re-select the original image without losing metadata, stats, or folder placement.'}
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
              <p className="settings-text settings-text--muted">{recoveryMessage(entry)}</p>
            </div>
            <label className="btn btn--secondary btn--sm">
              <ImagePlus size={14} aria-hidden="true" />
              {activeArtworkId === entry.artworkId ? 'Repairing...' : 'Repair image'}
              <input
                type="file"
                accept="image/*,.heic,.heif"
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
