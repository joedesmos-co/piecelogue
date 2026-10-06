import { downloadCloudArtworkImage, fetchCloudLibrary } from '../api/cloud.js'
import { db } from './database.js'
import { IMAGE_KINDS } from './artworkImageKeys.js'
import {
  clearImageRecoveryRequired,
  getArtworksNeedingImageRecovery,
  getDurableImageRecord,
} from './artworkImageStorage.js'
import { writeIncomingImageBytes } from './legacyImageMigration.js'
import { readStoredImageBytes } from './readStoredImageBytes.js'
import { normalizeArtworkImage } from '../utils/imageNormalize.js'

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
  const normalized = await normalizeArtworkImage(blob, {}, options.deps)
  const targetBlob =
    kind === IMAGE_KINDS.THUMBNAIL ? normalized.thumbnail : normalized.original
  const read = await writeIncomingImageBytes(artworkId, kind, targetBlob, options.deps)
  if (kind === IMAGE_KINDS.ORIGINAL) {
    await writeIncomingImageBytes(
      artworkId,
      IMAGE_KINDS.THUMBNAIL,
      normalized.thumbnail,
      options.deps,
    )
    await clearImageRecoveryRequired(artworkId, IMAGE_KINDS.THUMBNAIL)
  }
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

/**
 * Resolve the durable-record reader for image reads.
 *
 * The sync path calls resolveArtworkImageForSync() with no dependency injection,
 * so the default must be the real Dexie artworkImages store. Previously this
 * resolved to `async () => null`, which silently skipped durable bytes and made
 * every sync read fall through to the legacy artwork.image field.
 */
function resolveDurableRecordReader(options = {}) {
  return (
    options.getDurableRecord ?? options.deps?.getDurableRecord ?? getDurableImageRecord
  )
}

function buildImageReadDeps(options = {}) {
  // getDurableRecord is spread last so an injected undefined can never
  // reintroduce the null-returning fallback.
  return {
    ...options.deps,
    getDurableRecord: resolveDurableRecordReader(options),
  }
}

export async function resolveArtworkImageForSync(artwork, kind, options = {}) {
  const artworkId = artwork.id
  const legacyBlob = kind === IMAGE_KINDS.THUMBNAIL ? artwork.thumbnail : artwork.image
  let result = await readStoredImageBytes(
    artworkId,
    kind,
    { legacyBlob },
    buildImageReadDeps(options),
  )

  if (
    !result.ok &&
    (result.error.code === 'unreadable_blob' ||
      result.error.code === 'recovery_required' ||
      result.error.code === 'missing_image')
  ) {
    const repair = await tryRepairArtworkImageFromCloud(artworkId, kind, options)
    if (repair.repaired) {
      result = await readStoredImageBytes(artworkId, kind, {}, buildImageReadDeps(options))
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
