import { db } from './database'
import { IMAGE_KINDS } from './artworkImageKeys'
import { clearImageRecoveryRequired } from './artworkImageStorage'
import { writeIncomingImageBytes } from './legacyImageMigration'
import { normalizeArtworkImage } from '../utils/imageNormalize'

export async function getLocalLibraryCounts() {
  const [folderCount, artworkCount] = await Promise.all([
    db.folders.count(),
    db.artworks.count(),
  ])
  return { folderCount, artworkCount }
}

export async function upsertRestoredFolders(folders) {
  if (!folders.length) {
    return
  }

  await db.transaction('rw', db.folders, async () => {
    for (const folder of folders) {
      const existing = await db.folders.get(folder.id)
      await db.folders.put({ ...existing, ...folder })
    }
  })
}

/**
 * Merges cloud metadata over any existing local record without touching image bytes.
 */
export async function upsertRestoredArtworkMetadata(metadata) {
  const existing = await db.artworks.get(metadata.id)
  const metadataWithoutLegacyImages = { ...metadata }
  delete metadataWithoutLegacyImages.image
  delete metadataWithoutLegacyImages.thumbnail
  await db.artworks.put({
    ...existing,
    ...metadataWithoutLegacyImages,
  })
}

export async function saveRestoredArtworkImage(artworkId, imageType, blob) {
  const existing = await db.artworks.get(artworkId)
  if (!existing) {
    return
  }

  const kind = imageType === 'thumbnail' ? IMAGE_KINDS.THUMBNAIL : IMAGE_KINDS.ORIGINAL
  const normalized = await normalizeArtworkImage(blob)

  if (kind === IMAGE_KINDS.ORIGINAL) {
    await writeIncomingImageBytes(artworkId, IMAGE_KINDS.ORIGINAL, normalized.original)
    await writeIncomingImageBytes(artworkId, IMAGE_KINDS.THUMBNAIL, normalized.thumbnail)
    await clearImageRecoveryRequired(artworkId, IMAGE_KINDS.ORIGINAL)
    await clearImageRecoveryRequired(artworkId, IMAGE_KINDS.THUMBNAIL)
    return
  }

  await writeIncomingImageBytes(artworkId, IMAGE_KINDS.THUMBNAIL, normalized.thumbnail)
  await clearImageRecoveryRequired(artworkId, kind)
}

export async function saveRestoredArtworkImageBytes(artworkId, imageType, bytes, mimeType) {
  const existing = await db.artworks.get(artworkId)
  if (!existing) {
    return
  }

  const kind = imageType === 'thumbnail' ? IMAGE_KINDS.THUMBNAIL : IMAGE_KINDS.ORIGINAL
  const blob = new Blob([bytes], { type: mimeType || 'image/jpeg' })
  await saveRestoredArtworkImage(artworkId, kind === IMAGE_KINDS.THUMBNAIL ? 'thumbnail' : 'original', blob)
}
