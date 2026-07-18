import { db } from './database'
import { generateId } from '../utils/id'
import { calculateTotalMinutes } from '../utils/formatTime'
import { resolveMediumType, MEDIUM_TYPES } from '../utils/constants'
import { buildMetadataOnlyArtworkRecord } from './artworkPreservationCore'
import { IMAGE_KINDS } from './artworkImageKeys'
import {
  clearImageRecoveryRequired,
  deleteDurableImagesForArtwork,
  hasVerifiedDurableImage,
} from './artworkImageStorage'
import { enqueueArtworkImageSync } from '../sync/enqueue'
import { resetFailedJobsForUser } from '../db/syncQueueService'
import { getActiveSyncUserId } from '../sync/activeUser'
import { writeIncomingImageBytes } from './legacyImageMigration'
import { normalizeArtworkImage } from '../utils/imageNormalize'
import { bytesToBlob, readArtworkImageBytes } from './artworkImageReader'

function normalizeMediumType(value, fallbackArtwork) {
  if (value && MEDIUM_TYPES.includes(value)) return value
  if (fallbackArtwork) return resolveMediumType(fallbackArtwork)
  return 'Other'
}

function normalizeFolderId(value) {
  if (value === '' || value === undefined || value === null) return null
  return value
}

function normalizeArtworkData(data, existing = null) {
  const hours = Math.max(0, Number(data.hours) || 0)
  const minutes = Math.max(0, Math.min(59, Number(data.minutes) || 0))

  return {
    title: (data.title || '').trim(),
    mediumType: normalizeMediumType(data.mediumType, existing),
    medium: (data.medium || '').trim(),
    folderId: normalizeFolderId(data.folderId),
    status: data.status || 'In Progress',
    hours,
    minutes,
    totalMinutes: calculateTotalMinutes(hours, minutes),
    artworkDate: data.artworkDate || null,
    notes: data.notes || '',
    favorite: Boolean(data.favorite),
  }
}

function normalizeArtworkRecord(artwork) {
  if (!artwork) return artwork

  const normalized = {
    ...artwork,
    mediumType: resolveMediumType(artwork),
    folderId: artwork.folderId ?? null,
  }
  delete normalized.type
  delete normalized.category
  delete normalized.collection
  return normalized
}

async function persistArtworkImages(artworkId, imageBlob) {
  const normalized = await normalizeArtworkImage(imageBlob)
  await writeIncomingImageBytes(artworkId, IMAGE_KINDS.ORIGINAL, normalized.original)
  await writeIncomingImageBytes(artworkId, IMAGE_KINDS.THUMBNAIL, normalized.thumbnail)
  await clearImageRecoveryRequired(artworkId, IMAGE_KINDS.ORIGINAL)
  await clearImageRecoveryRequired(artworkId, IMAGE_KINDS.THUMBNAIL)
  return normalized
}

export async function ensureThumbnailFromOriginal(artworkId) {
  if (await hasVerifiedDurableImage(artworkId, IMAGE_KINDS.THUMBNAIL)) {
    return { created: false }
  }

  const original = await readArtworkImageBytes(artworkId, IMAGE_KINDS.ORIGINAL)
  if (!original.ok) {
    return { created: false, error: original.error }
  }

  const originalBlob = bytesToBlob(original.bytes, original.mimeType || 'image/jpeg')
  const normalized = await normalizeArtworkImage(originalBlob)
  await writeIncomingImageBytes(artworkId, IMAGE_KINDS.THUMBNAIL, normalized.thumbnail)
  await clearImageRecoveryRequired(artworkId, IMAGE_KINDS.THUMBNAIL)
  return { created: true }
}

async function saveArtworkRecord(existing, scalarUpdates, imageBlob = null) {
  const updatedAt = new Date().toISOString()
  let record = buildMetadataOnlyArtworkRecord(existing, {
    ...scalarUpdates,
    updatedAt,
  })

  if (imageBlob) {
    await persistArtworkImages(record.id, imageBlob)
  }

  await db.artworks.put(record)
  return normalizeArtworkRecord(record)
}

export async function getAllArtworks() {
  const artworks = await db.artworks.orderBy('updatedAt').reverse().toArray()
  return artworks.map(normalizeArtworkRecord)
}

export async function getArtworkById(id) {
  const artwork = await db.artworks.get(id)
  return normalizeArtworkRecord(artwork)
}

export async function getArtworksByFolderId(folderId) {
  if (!folderId) {
    const all = await getAllArtworks()
    return all.filter((artwork) => !artwork.folderId)
  }

  const artworks = await db.artworks.where('folderId').equals(folderId).toArray()
  return artworks
    .map(normalizeArtworkRecord)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
}

export async function artworkHasLocalImage(artworkId, kind = IMAGE_KINDS.ORIGINAL) {
  if (await hasVerifiedDurableImage(artworkId, kind)) {
    return true
  }

  const artwork = await db.artworks.get(artworkId)
  if (!artwork) {
    return false
  }

  const legacy = kind === IMAGE_KINDS.THUMBNAIL ? artwork.thumbnail : artwork.image
  return Boolean(legacy)
}

export async function createArtwork(data, imageBlob) {
  if (!imageBlob) {
    throw new Error('An artwork image is required.')
  }

  const normalized = normalizeArtworkData(data)
  if (!normalized.title) {
    throw new Error('A title is required.')
  }

  const now = new Date().toISOString()
  const id = generateId()

  const artwork = {
    id,
    ...normalized,
    createdAt: now,
    updatedAt: now,
  }

  await persistArtworkImages(id, imageBlob)
  await db.artworks.add(artwork)
  return artwork
}

export async function updateArtwork(id, data, imageBlob = null) {
  const existing = await db.artworks.get(id)
  if (!existing) {
    throw new Error('Artwork not found.')
  }

  const normalized = normalizeArtworkData({ ...existing, ...data }, existing)
  if (!normalized.title) {
    throw new Error('A title is required.')
  }

  return saveArtworkRecord(existing, normalized, imageBlob)
}

export async function repairArtworkImage(id, imageBlob) {
  const existing = await db.artworks.get(id)
  if (!existing) {
    throw new Error('Artwork not found.')
  }
  if (!imageBlob) {
    throw new Error('An artwork image is required.')
  }

  await persistArtworkImages(id, imageBlob)
  const userId = getActiveSyncUserId()
  if (userId) {
    await resetFailedJobsForUser(userId)
    await enqueueArtworkImageSync(id)
  }
  return saveArtworkRecord(existing, {})
}

export async function moveArtworkToFolder(id, folderId) {
  const existing = await db.artworks.get(id)
  if (!existing) {
    throw new Error('Artwork not found.')
  }

  return saveArtworkRecord(existing, {
    folderId: normalizeFolderId(folderId),
  })
}

export async function deleteArtwork(id) {
  await db.transaction('rw', db.artworks, db.artworkImages, async () => {
    await deleteDurableImagesForArtwork(id)
    await db.artworks.delete(id)
  })
}

export async function toggleFavorite(id) {
  const artwork = await db.artworks.get(id)
  if (!artwork) {
    throw new Error('Artwork not found.')
  }

  const favorite = !artwork.favorite
  return saveArtworkRecord(artwork, { favorite })
}

export async function getStats() {
  const artworks = await getAllArtworks()

  let finished = 0
  let inProgress = 0
  let totalMinutes = 0
  let digitalMinutes = 0
  let traditionalMinutes = 0
  let otherMinutes = 0

  for (const artwork of artworks) {
    if (artwork.status === 'Finished') finished++
    else inProgress++

    const minutes = artwork.totalMinutes || 0
    totalMinutes += minutes

    const mediumType = resolveMediumType(artwork)
    if (mediumType === 'Digital') digitalMinutes += minutes
    else if (mediumType === 'Traditional') traditionalMinutes += minutes
    else otherMinutes += minutes
  }

  return {
    totalArtworks: artworks.length,
    finished,
    inProgress,
    totalMinutes,
    digitalMinutes,
    traditionalMinutes,
    otherMinutes,
  }
}
