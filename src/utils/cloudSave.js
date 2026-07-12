import * as artworkService from '../db/artworkService'
import * as folderService from '../db/folderService'
import { clearSyncQueueForUser } from '../db/syncQueueService'
import { setArtworkCloudRevision, setFolderCloudRevision } from '../db/syncRevisionService'
import { IMAGE_KINDS } from '../db/artworkImageKeys'
import { ensureArtworkImagesMigrated } from '../db/legacyImageMigration'
import { resolveArtworkImageForSync } from '../db/imageRepair'
import { markImageRecoveryRequired } from '../db/artworkImageStorage'
import { ImageReadError } from '../db/imageReadError'
import {
  uploadCloudArtworkOriginal,
  uploadCloudArtworkThumbnail,
  uploadCloudArtworks,
  uploadCloudFolders,
} from '../api/cloud'
import { toCloudArtworkMetadata, toCloudFolder } from '../sync/cloudPayload'
import { describeImageUploadStage, prepareBytesForUpload } from '../sync/imageUpload'
import {
  recordForceSyncComplete,
  waitForBackgroundProcessorIdle,
  wakeSyncProcessor,
} from '../sync/processor'
import { createUploadRequestId } from '../sync/uploadDiagnostics'
import {
  releaseArtworkUpload,
  releaseForceSyncLock,
  tryAcquireArtworkUpload,
  tryAcquireForceSyncLock,
} from '../sync/syncLock'
import { ApiError } from './api'

const METADATA_BATCH_SIZE = 25

async function buildImageUploadSteps(artworks) {
  const steps = []

  for (const artwork of artworks) {
    await ensureArtworkImagesMigrated(artwork.id)
    const original = await resolveArtworkImageForSync(artwork, IMAGE_KINDS.ORIGINAL)
    if (original.ok) {
      steps.push({ artwork, type: 'original', bytes: original.bytes, mimeType: original.mimeType })
    }

    const thumbnail = await resolveArtworkImageForSync(artwork, IMAGE_KINDS.THUMBNAIL)
    if (thumbnail.ok) {
      steps.push({
        artwork,
        type: 'thumbnail',
        bytes: thumbnail.bytes,
        mimeType: thumbnail.mimeType,
      })
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
    await waitForBackgroundProcessorIdle(signal)
    const folders = await folderService.getAllFolders()
    const artworks = await artworkService.getAllArtworks()
    const imageSteps = await buildImageUploadSteps(artworks)

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

      const { artwork, type, bytes, mimeType } = imageSteps[index]

      if (!tryAcquireArtworkUpload(artwork.id, 'force')) {
        throw new ApiError(
          'Another sync is already uploading this artwork.',
          'sync_in_progress',
          409,
        )
      }

      try {
        const prepared = await prepareBytesForUpload(bytes, {
          stage: type,
          artworkTitle: artwork.title,
          artworkId: artwork.id,
          mimeType,
        })
        const requestId = createUploadRequestId()

        onProgress?.({
          phase: 'images',
          message: describeImageUploadStage(type),
          current: index,
          total: imageSteps.length,
          artworkTitle: artwork.title,
          stage: type,
          requestId,
          mimeType: prepared.mimeType,
          format: prepared.format,
          blobSize: prepared.blobSize,
          byteSize: prepared.byteSize,
          exceedsLimit: prepared.exceedsLimit,
        })

        if (type === 'original') {
          await uploadCloudArtworkOriginal(artwork.id, prepared.body, {
            contentType: prepared.mimeType,
            signal,
            requestId,
            ...prepared,
          })
        } else {
          await uploadCloudArtworkThumbnail(artwork.id, prepared.body, {
            contentType: prepared.mimeType,
            signal,
            requestId,
            ...prepared,
          })
        }
      } catch (error) {
        if (error instanceof ImageReadError) {
          await markImageRecoveryRequired(artwork.id, type, error.code)
        }
        throw error
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
