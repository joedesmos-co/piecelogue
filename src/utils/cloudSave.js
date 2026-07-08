import * as artworkService from '../db/artworkService'
import * as folderService from '../db/folderService'
import {
  uploadCloudArtworkOriginal,
  uploadCloudArtworkThumbnail,
  uploadCloudArtworks,
  uploadCloudFolders,
} from '../api/cloud'
import { getFullImageBlob, getGalleryImageBlob } from './imageUtils'

const METADATA_BATCH_SIZE = 25

function toCloudArtworkMetadata(artwork) {
  return {
    id: artwork.id,
    folderId: artwork.folderId ?? null,
    title: artwork.title,
    mediumType: artwork.mediumType,
    medium: artwork.medium ?? '',
    status: artwork.status,
    hours: artwork.hours ?? 0,
    minutes: artwork.minutes ?? 0,
    totalMinutes: artwork.totalMinutes ?? 0,
    artworkDate: artwork.artworkDate ?? null,
    notes: artwork.notes ?? '',
    favorite: Boolean(artwork.favorite),
    createdAt: artwork.createdAt,
    updatedAt: artwork.updatedAt,
  }
}

function toCloudFolder(folder) {
  return {
    id: folder.id,
    name: folder.name,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  }
}

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

export async function saveLibraryToCloud({ onProgress }) {
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
    await uploadCloudFolders(folders.map(toCloudFolder))
  }

  onProgress?.({
    phase: 'metadata',
    message: 'Saving artwork details...',
    current: 0,
    total: artworks.length,
  })

  for (let index = 0; index < artworks.length; index += METADATA_BATCH_SIZE) {
    const batch = artworks.slice(index, index + METADATA_BATCH_SIZE)
    await uploadCloudArtworks(batch.map(toCloudArtworkMetadata))
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
