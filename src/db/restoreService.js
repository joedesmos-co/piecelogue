import { db } from './database'
import { IMAGE_KINDS } from './artworkImageKeys'
import { getDurableImageRecord, saveDurableImageBytes } from './artworkImageStorage'
import { hashBytes } from '../sync/imageHash'

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

  const bytes = new Uint8Array(await blob.arrayBuffer())
  const sourceHash = await hashBytes(bytes)
  await db.transaction('rw', db.artworkImages, async () => {
    if (kind === IMAGE_KINDS.ORIGINAL) {
      const current = await getDurableImageRecord(artworkId, kind)
      // Preserve the best pre-existing local file even on explicit cloud restore.
      if (current?.data && current.origin !== 'cloud' && !(await getDurableImageRecord(artworkId, IMAGE_KINDS.SOURCE))) {
        await saveDurableImageBytes(artworkId, IMAGE_KINDS.SOURCE, current.data, current.mimeType, { origin: 'local' })
      }
    }
    await saveDurableImageBytes(artworkId, kind, bytes, blob.type, { origin: 'cloud' })
    if (kind === IMAGE_KINDS.ORIGINAL) {
      await saveDurableImageBytes(artworkId, IMAGE_KINDS.DISPLAY, bytes, blob.type, { origin: 'cloud', sourceHash })
    }
  })
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
