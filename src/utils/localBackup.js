import { db } from '../db/database.js'
import * as artworkService from '../db/artworkService.js'
import * as folderService from '../db/folderService.js'
import { APP_NAME, APP_VERSION } from './constants.js'
import { IMAGE_KINDS } from '../db/artworkImageKeys'
import { readArtworkImageBytes, bytesToBlob } from '../db/artworkImageReader'
import { writeIncomingImageBytes } from '../db/legacyImageMigration'
import { normalizeArtworkImage } from './imageNormalize.js'
import {
  getBackupVersion,
  MAX_BACKUP_BYTES,
  parseLocalBackupText,
  validateLocalBackup,
} from './localBackupCore.js'

const BACKUP_VERSION = getBackupVersion()

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

    const original = await readArtworkImageBytes(artwork.id, IMAGE_KINDS.ORIGINAL, {
      legacyBlob: artwork.image,
    })
    if (original.ok) {
      record.image = {
        type: original.mimeType || 'image/jpeg',
        data: await blobToBase64(bytesToBlob(original.bytes, original.mimeType)),
      }
    }

    const thumbnail = await readArtworkImageBytes(artwork.id, IMAGE_KINDS.THUMBNAIL, {
      legacyBlob: artwork.thumbnail,
    })
    if (thumbnail.ok) {
      record.thumbnail = {
        type: thumbnail.mimeType || 'image/jpeg',
        data: await blobToBase64(bytesToBlob(thumbnail.bytes, thumbnail.mimeType)),
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

function base64ToBlob(base64, type) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new Blob([bytes], { type: type || 'image/jpeg' })
}

export { parseLocalBackupText, validateLocalBackup }

export async function importLocalBackup(backup) {
  const validated = validateLocalBackup(backup)
  const now = new Date().toISOString()

  await db.transaction('rw', db.folders, db.artworks, db.artworkImages, async () => {
    for (const folder of validated.folders) {
      const existing = await db.folders.get(folder.id)
      await db.folders.put({
        ...existing,
        id: folder.id,
        name: folder.name,
        parentFolderId: folder.parentFolderId ?? null,
        createdAt: folder.createdAt || existing?.createdAt || now,
        updatedAt: folder.updatedAt || now,
        cloudRevision: existing?.cloudRevision ?? 0,
      })
    }

    for (const artwork of validated.artworks) {
      const existing = await db.artworks.get(artwork.id)
      const record = {
        ...existing,
        id: artwork.id,
        title: artwork.title,
        mediumType: artwork.mediumType || existing?.mediumType || 'Other',
        medium: artwork.medium ?? '',
        folderId: artwork.folderId ?? null,
        status: artwork.status || 'In Progress',
        hours: artwork.hours ?? 0,
        minutes: artwork.minutes ?? 0,
        totalMinutes: artwork.totalMinutes ?? 0,
        artworkDate: artwork.artworkDate ?? null,
        notes: artwork.notes ?? '',
        favorite: Boolean(artwork.favorite),
        createdAt: artwork.createdAt || existing?.createdAt || now,
        updatedAt: artwork.updatedAt || now,
        cloudRevision: existing?.cloudRevision ?? 0,
      }

      if (artwork.image?.data) {
        const imageBlob = base64ToBlob(artwork.image.data, artwork.image.type)
        const normalized = await normalizeArtworkImage(imageBlob)
        await writeIncomingImageBytes(artwork.id, IMAGE_KINDS.ORIGINAL, normalized.original)
        await writeIncomingImageBytes(artwork.id, IMAGE_KINDS.THUMBNAIL, normalized.thumbnail)
      } else if (artwork.thumbnail?.data) {
        const thumbnailBlob = base64ToBlob(artwork.thumbnail.data, artwork.thumbnail.type)
        const normalized = await normalizeArtworkImage(thumbnailBlob)
        await writeIncomingImageBytes(artwork.id, IMAGE_KINDS.THUMBNAIL, normalized.thumbnail)
      }

      await db.artworks.put(record)
    }
  })

  return {
    folderCount: validated.folders.length,
    artworkCount: validated.artworks.length,
  }
}

export async function readBackupFile(file) {
  if (!file) {
    throw new Error('No backup file selected.')
  }

  if (file.size > MAX_BACKUP_BYTES) {
    throw new Error('Backup file is too large to import.')
  }

  const text = await file.text()
  return parseLocalBackupText(text)
}
