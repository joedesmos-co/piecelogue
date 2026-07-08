import * as artworkService from '../db/artworkService'
import * as folderService from '../db/folderService'
import { APP_NAME, APP_VERSION } from './constants'
import { getFullImageBlob, getGalleryImageBlob } from './imageUtils'

const BACKUP_VERSION = 1

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Failed to read image data.'))
        return
      }
      const base64 = result.split(',')[1]
      resolve(base64 || '')
    }
    reader.onerror = () => reject(new Error('Failed to read image data.'))
    reader.readAsDataURL(blob)
  })
}

function serializeArtwork(artwork) {
  return {
    id: artwork.id,
    title: artwork.title,
    mediumType: artwork.mediumType,
    medium: artwork.medium ?? '',
    folderId: artwork.folderId ?? null,
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

export async function buildLocalBackup() {
  const [folders, artworks] = await Promise.all([
    folderService.getAllFolders(),
    artworkService.getAllArtworks(),
  ])

  const serializedArtworks = []

  for (const artwork of artworks) {
    const record = serializeArtwork(artwork)
    const imageBlob = getFullImageBlob(artwork)
    const thumbnailBlob = getGalleryImageBlob(artwork)

    if (imageBlob) {
      record.image = {
        type: imageBlob.type || 'image/jpeg',
        data: await blobToBase64(imageBlob),
      }
    }

    if (thumbnailBlob && thumbnailBlob !== imageBlob) {
      record.thumbnail = {
        type: thumbnailBlob.type || 'image/jpeg',
        data: await blobToBase64(thumbnailBlob),
      }
    }

    serializedArtworks.push(record)
  }

  return {
    backupVersion: BACKUP_VERSION,
    app: APP_NAME,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    folderCount: folders.length,
    artworkCount: serializedArtworks.length,
    folders: folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      parentFolderId: folder.parentFolderId ?? null,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    })),
    artworks: serializedArtworks,
  }
}

export async function downloadLocalBackup() {
  const backup = await buildLocalBackup()
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const date = new Date().toISOString().slice(0, 10)

  try {
    const link = document.createElement('a')
    link.href = url
    link.download = `piecelogue-backup-${date}.json`
    link.click()
  } finally {
    URL.revokeObjectURL(url)
  }

  return {
    folderCount: backup.folderCount,
    artworkCount: backup.artworkCount,
  }
}
