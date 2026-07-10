import { db } from './database'

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
 * Merges cloud metadata over any existing local record so local image
 * blobs are preserved when a cloud image download is missing or fails.
 */
export async function upsertRestoredArtworkMetadata(metadata) {
  const existing = await db.artworks.get(metadata.id)
  await db.artworks.put({
    ...existing,
    ...metadata,
    image: metadata.image ?? existing?.image,
    thumbnail: metadata.thumbnail ?? existing?.thumbnail,
  })
}

export async function saveRestoredArtworkImage(artworkId, imageType, blob) {
  const existing = await db.artworks.get(artworkId)
  if (!existing) {
    return
  }

  const updates = imageType === 'thumbnail' ? { thumbnail: blob } : { image: blob }
  await db.artworks.put({ ...existing, ...updates })
}
