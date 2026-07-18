import { downloadCloudArtworkImage, fetchCloudLibrary } from '../api/cloud'
import {
  saveRestoredArtworkImage,
  upsertRestoredArtworkMetadata,
  upsertRestoredFolders,
} from '../db/restoreService'
import { setImageHashes } from '../db/syncImageHashService'
import { markLibrarySeeded, setLastSyncedAt } from '../db/syncStateService'
import { hashBytes } from '../sync/imageHash'
import { IMAGE_KINDS } from '../db/artworkImageKeys'
import { readArtworkImageBytes } from '../db/artworkImageReader'
import { ensureThumbnailFromOriginal } from '../db/artworkService'
import { markImageRecoveryRequired } from '../db/artworkImageStorage'
import {
  buildImageDownloadSteps,
  shouldRegenerateThumbnailFromCloud,
  toLocalArtworkMetadata,
  toLocalFolder,
} from '../sync/restoreLogic'
import { findIncompleteCloudArtworks } from '../sync/incompleteCloudImages'
import { setCachedIncompleteCloudImages } from '../sync/reconcileIncompleteCloudImages'

const MAX_IMAGE_DOWNLOAD_CONCURRENCY = 2

async function runWithConcurrency(items, limit, handler) {
  const queue = [...items]
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()
      if (item) {
        await handler(item)
      }
    }
  })

  await Promise.all(workers)
}

export async function restoreLibraryFromCloud({ userId, onProgress } = {}) {
  onProgress?.({ phase: 'checking', message: 'Checking cloud...', current: 0, total: 0 })

  const library = await fetchCloudLibrary()
  const folders = library.folders.map(toLocalFolder)
  const artworks = library.artworks.map(toLocalArtworkMetadata)
  const imageSteps = buildImageDownloadSteps(library.artworks)
  const incompleteCloudImages = findIncompleteCloudArtworks(library.artworks)
  setCachedIncompleteCloudImages(incompleteCloudImages)

  // Mark the library as seeded up front so the auto-sync first-login seeding
  // does not enqueue restored items for re-upload.
  if (userId) {
    await markLibrarySeeded(userId)
  }

  onProgress?.({
    phase: 'folders',
    message: 'Restoring folders...',
    current: 0,
    total: folders.length,
  })

  await upsertRestoredFolders(folders)

  onProgress?.({
    phase: 'artworks',
    message: 'Restoring artworks...',
    current: 0,
    total: artworks.length,
  })

  for (let index = 0; index < artworks.length; index += 1) {
    await upsertRestoredArtworkMetadata(artworks[index])
    onProgress?.({
      phase: 'artworks',
      message: 'Restoring artworks...',
      current: index + 1,
      total: artworks.length,
    })
  }

  const downloadedHashes = new Map()
  const failedImages = []
  let downloadedCount = 0

  const reportImageProgress = () => {
    onProgress?.({
      phase: 'images',
      message: `Downloading images (${downloadedCount}/${imageSteps.length})...`,
      current: downloadedCount,
      total: imageSteps.length,
    })
  }

  reportImageProgress()

  await runWithConcurrency(imageSteps, MAX_IMAGE_DOWNLOAD_CONCURRENCY, async (step) => {
    try {
      const blob = await downloadCloudArtworkImage(step.artworkId, step.type)
      await saveRestoredArtworkImage(step.artworkId, step.type, blob)

      const kind = step.type === 'thumbnail' ? IMAGE_KINDS.THUMBNAIL : IMAGE_KINDS.ORIGINAL
      const read = await readArtworkImageBytes(step.artworkId, kind)
      const hash = read.ok ? await hashBytes(read.bytes) : null
      const entry = downloadedHashes.get(step.artworkId) || {}
      if (step.type === 'original') {
        entry.originalHash = hash
      } else {
        entry.thumbnailHash = hash
      }
      downloadedHashes.set(step.artworkId, entry)
    } catch (error) {
      failedImages.push({
        artworkId: step.artworkId,
        title: step.title,
        type: step.type,
        message: error?.message || 'Download failed.',
      })
    } finally {
      downloadedCount += 1
      reportImageProgress()
    }
  })

  // Original-only cloud artworks: regenerate a local thumbnail when possible.
  for (const cloudArtwork of library.artworks) {
    if (shouldRegenerateThumbnailFromCloud(cloudArtwork)) {
      try {
        const result = await ensureThumbnailFromOriginal(cloudArtwork.id)
        if (result.created) {
          const read = await readArtworkImageBytes(cloudArtwork.id, IMAGE_KINDS.THUMBNAIL)
          if (read.ok && userId) {
            const entry = downloadedHashes.get(cloudArtwork.id) || {}
            entry.thumbnailHash = await hashBytes(read.bytes)
            downloadedHashes.set(cloudArtwork.id, entry)
          }
        }
      } catch {
        // Keep metadata; thumbnail can be repaired later.
      }
    }

    if (!cloudArtwork.hasOriginal) {
      await markImageRecoveryRequired(cloudArtwork.id, IMAGE_KINDS.ORIGINAL, 'cloud_incomplete')
    }
  }

  if (userId) {
    for (const [artworkId, hashes] of downloadedHashes) {
      await setImageHashes(userId, artworkId, hashes)
    }
    await setLastSyncedAt(userId)
  }

  onProgress?.({
    phase: 'done',
    message: 'Restore complete.',
    current: imageSteps.length,
    total: imageSteps.length,
  })

  return {
    folderCount: folders.length,
    artworkCount: artworks.length,
    imageCount: imageSteps.length,
    failedImageCount: failedImages.length,
    failedImages,
    incompleteCloudImageCount: incompleteCloudImages.length,
    incompleteCloudImages,
  }
}
