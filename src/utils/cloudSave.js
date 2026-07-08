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
import { recordForceSyncComplete } from '../sync/processor'
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
    const response = await uploadCloudFolders(folders.map((folder) => toCloudFolder(folder, { force: true })))
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
    const batch = artworks.slice(index, index + METADATA_BATCH_SIZE)
    const response = await uploadCloudArtworks(
      batch.map((artwork) => toCloudArtworkMetadata(artwork, { force: true })),
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
    const { artwork, type } = imageSteps[index]
    const blob = type === 'original' ? getFullImageBlob(artwork) : getGalleryImageBlob(artwork)

    onProgress?.({
      phase: 'images',
      message: `Uploading images (${index + 1}/${imageSteps.length})...`,
      current: index,
      total: imageSteps.length,
      artworkTitle: artwork.title,
    })

    if (type === 'original') {
      await uploadCloudArtworkOriginal(artwork.id, blob)
    } else {
      await uploadCloudArtworkThumbnail(artwork.id, blob)
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
}
