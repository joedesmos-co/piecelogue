import * as artworkService from '../db/artworkService'
import * as folderService from '../db/folderService'
import { clearSyncQueueForUser } from '../db/syncQueueService'
import { setArtworkCloudRevision, setFolderCloudRevision } from '../db/syncRevisionService'
import {
  uploadCloudArtworkOriginal,
  uploadCloudArtworkThumbnail,
  uploadCloudArtworks,
  uploadCloudFolders,
} from '../api/cloud'
import { toCloudArtworkMetadata, toCloudFolder } from '../sync/cloudPayload'
import { describeImageUploadStage, prepareBlobForUpload } from '../sync/imageUpload'
import { recordForceSyncComplete, wakeSyncProcessor } from '../sync/processor'
import {
  releaseArtworkUpload,
  releaseForceSyncLock,
  tryAcquireArtworkUpload,
  tryAcquireForceSyncLock,
} from '../sync/syncLock'
import { ApiError } from './api'
import { getFullImageBlob, getGalleryImageBlob } from './imageUtils'

const METADATA_BATCH_SIZE = 25

function buildImageUploadSteps(artworks) {
  const steps = []

  for (const artwork of artworks) {
    if (getFullImageBlob(artwork)) {
      steps.push({ artwork, type: 'original' })
    }
    if (getGalleryImageBlob(artwork)) {
      steps.push({ artwork, type: 'thumbnail' })
    }
  }

  return steps
}

export async function saveLibraryToCloud({ onProgress, userId } = {}) {
  const lock = tryAcquireForceSyncLock(userId)
  if (!lock) {
    throw new ApiError('Sync already in progress.', 'sync_in_progress', 409)
  }

  const signal = lock.signal
  wakeSyncProcessor()

  try {
    const folders = await folderService.getAllFolders()
    const artworks = await artworkService.getAllArtworks()
    const imageSteps = buildImageUploadSteps(artworks)

    onProgress?.({
      phase: 'folders',
      message: 'Saving folders...',
      current: 0,
      total: folders.length,
    })

    if (folders.length > 0) {
      const response = await uploadCloudFolders(
        folders.map((folder) => toCloudFolder(folder, { force: true })),
        { signal },
      )
      for (const result of response.results ?? []) {
        if (result.revision) {
          await setFolderCloudRevision(result.id, result.revision)
        }
      }
    }

    onProgress?.({
      phase: 'metadata',
      message: 'Saving artwork details...',
      current: 0,
      total: artworks.length,
    })

    for (let index = 0; index < artworks.length; index += METADATA_BATCH_SIZE) {
      if (signal.aborted) {
        throw new ApiError('Sync cancelled.', 'cancelled', 0)
      }

      const batch = artworks.slice(index, index + METADATA_BATCH_SIZE)
      const response = await uploadCloudArtworks(
        batch.map((artwork) => toCloudArtworkMetadata(artwork, { force: true })),
        { signal },
      )
      for (const result of response.results ?? []) {
        if (result.revision) {
          await setArtworkCloudRevision(result.id, result.revision)
        }
      }
      onProgress?.({
        phase: 'metadata',
        message: 'Saving artwork details...',
        current: Math.min(index + batch.length, artworks.length),
        total: artworks.length,
      })
    }

    for (let index = 0; index < imageSteps.length; index += 1) {
      if (signal.aborted) {
        throw new ApiError('Sync cancelled.', 'cancelled', 0)
      }

      const { artwork, type } = imageSteps[index]
      const blob = type === 'original' ? getFullImageBlob(artwork) : getGalleryImageBlob(artwork)

      if (!tryAcquireArtworkUpload(artwork.id, 'force')) {
        throw new ApiError(
          'Another sync is already uploading this artwork.',
          'sync_in_progress',
          409,
        )
      }

      try {
        const prepared = await prepareBlobForUpload(blob, {
          stage: type,
          artworkTitle: artwork.title,
          artworkId: artwork.id,
        })

        onProgress?.({
          phase: 'images',
          message: describeImageUploadStage(type),
          current: index,
          total: imageSteps.length,
          artworkTitle: artwork.title,
          stage: type,
        })

        if (type === 'original') {
          await uploadCloudArtworkOriginal(artwork.id, prepared.blob, {
            contentType: prepared.mimeType,
            signal,
          })
        } else {
          await uploadCloudArtworkThumbnail(artwork.id, prepared.blob, {
            contentType: prepared.mimeType,
            signal,
          })
        }
      } finally {
        releaseArtworkUpload(artwork.id)
      }
    }

    if (userId) {
      await clearSyncQueueForUser(userId)
      await recordForceSyncComplete(userId, artworks)
    }

    onProgress?.({
      phase: 'done',
      message: 'Library saved to cloud.',
      current: imageSteps.length,
      total: imageSteps.length,
    })

    return {
      folderCount: folders.length,
      artworkCount: artworks.length,
      imageCount: imageSteps.length,
    }
  } finally {
    releaseForceSyncLock()
    wakeSyncProcessor()
  }
}
