import { downloadCloudArtworkImage, fetchCloudLibrary } from '../api/cloud.js'
import { db } from './database.js'
import { IMAGE_KINDS } from './artworkImageKeys.js'
import {
  clearImageRecoveryRequired,
  getArtworksNeedingImageRecovery,
} from './artworkImageStorage.js'
import { writeIncomingImageBytes } from './legacyImageMigration.js'
import { readStoredImageBytes } from './readStoredImageBytes.js'

function cloudArtworkHasImage(cloudArtwork, kind) {
  if (kind === IMAGE_KINDS.THUMBNAIL) {
    return Boolean(cloudArtwork?.hasThumbnail)
  }
  return Boolean(cloudArtwork?.hasOriginal)
}

export async function tryRepairArtworkImageFromCloud(artworkId, kind, options = {}) {
  const downloadImage = options.downloadImage ?? downloadCloudArtworkImage
  const fetchLibrary = options.fetchLibrary ?? fetchCloudLibrary

  const library = await fetchLibrary()
  const cloudArtwork = library.artworks.find((entry) => entry.id === artworkId)
  if (!cloudArtwork || !cloudArtworkHasImage(cloudArtwork, kind)) {
    return { repaired: false, reason: 'cloud_missing' }
  }

  const blob = await downloadImage(artworkId, kind)
  const read = await writeIncomingImageBytes(artworkId, kind, blob, options.deps)
  await clearImageRecoveryRequired(artworkId, kind)
  return {
    repaired: true,
    byteLength: read.byteLength,
    mimeType: read.mimeType,
  }
}

export async function repairArtworkImagesFromCloud(artworkId, options = {}) {
  const results = []
  for (const kind of [IMAGE_KINDS.ORIGINAL, IMAGE_KINDS.THUMBNAIL]) {
    try {
      results.push({
        kind,
        ...(await tryRepairArtworkImageFromCloud(artworkId, kind, options)),
      })
    } catch (error) {
      results.push({
        kind,
        repaired: false,
        reason: error?.code || 'download_failed',
        message: error?.message || 'Cloud repair failed.',
      })
    }
  }
  return results
}

export async function resolveArtworkImageForSync(artwork, kind, options = {}) {
  const artworkId = artwork.id
  const legacyBlob = kind === IMAGE_KINDS.THUMBNAIL ? artwork.thumbnail : artwork.image
  let result = await readStoredImageBytes(
    artworkId,
    kind,
    { legacyBlob },
    {
      getDurableRecord: options.getDurableRecord,
      ...options.deps,
    },
  )

  if (
    !result.ok &&
    (result.error.code === 'unreadable_blob' ||
      result.error.code === 'recovery_required' ||
      result.error.code === 'missing_image')
  ) {
    const repair = await tryRepairArtworkImageFromCloud(artworkId, kind, options)
    if (repair.repaired) {
      result = await readStoredImageBytes(artworkId, kind, {}, options.deps)
    }
  }

  return result
}

export async function getRecoveryRequiredArtworksWithTitles() {
  const recoveryEntries = await getArtworksNeedingImageRecovery()
  const enriched = []

  for (const entry of recoveryEntries) {
    const artwork = await db.artworks.get(entry.artworkId)
    enriched.push({
      ...entry,
      title: artwork?.title || 'Untitled artwork',
    })
  }

  return enriched
}

export { getArtworksNeedingImageRecovery }
