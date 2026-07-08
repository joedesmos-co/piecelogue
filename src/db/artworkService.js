import { db } from './database'
import { generateId } from '../utils/id'
import { calculateTotalMinutes } from '../utils/formatTime'
import { createThumbnail, coalesceArtworkBlobs } from '../utils/imageUtils'
import { resolveMediumType, MEDIUM_TYPES } from '../utils/constants'

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

  const coalesced = coalesceArtworkBlobs(artwork)
  const normalized = {
    ...coalesced,
    mediumType: resolveMediumType(artwork),
    folderId: artwork.folderId ?? null,
  }
  delete normalized.type
  delete normalized.category
  delete normalized.collection
  return normalized
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

export async function createArtwork(data, imageBlob) {
  if (!imageBlob) {
    throw new Error('An artwork image is required.')
  }

  const normalized = normalizeArtworkData(data)
  if (!normalized.title) {
    throw new Error('A title is required.')
  }

  const thumbnail = await createThumbnail(imageBlob)
  const now = new Date().toISOString()
  const id = generateId()

  const artwork = {
    id,
    ...normalized,
    image: imageBlob,
    thumbnail,
    createdAt: now,
    updatedAt: now,
  }

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

  const updates = {
    ...normalized,
    updatedAt: new Date().toISOString(),
  }

  if (imageBlob) {
    updates.image = imageBlob
    updates.thumbnail = await createThumbnail(imageBlob)
  }

  await db.artworks.update(id, updates)
  return normalizeArtworkRecord({ ...existing, ...updates })
}

export async function deleteArtwork(id) {
  await db.artworks.delete(id)
}

export async function toggleFavorite(id) {
  const artwork = await db.artworks.get(id)
  if (!artwork) {
    throw new Error('Artwork not found.')
  }

  const favorite = !artwork.favorite
  await db.artworks.update(id, {
    favorite,
    updatedAt: new Date().toISOString(),
  })
  return normalizeArtworkRecord({ ...artwork, favorite })
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
