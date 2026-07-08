import Dexie from 'dexie'
import { MEDIUM_TYPES } from '../utils/constants'
import { generateId } from '../utils/id'

export const db = new Dexie('piecelogue')

db.version(1).stores({
  artworks:
    'id, title, type, category, medium, collection, status, favorite, artworkDate, createdAt, updatedAt, totalMinutes',
})

db.version(2).stores({
  artworks:
    'id, title, mediumType, medium, collection, status, favorite, artworkDate, createdAt, updatedAt, totalMinutes',
}).upgrade(async (tx) => {
  await tx.table('artworks').toCollection().modify((artwork) => {
    if (artwork.mediumType && MEDIUM_TYPES.includes(artwork.mediumType)) {
      delete artwork.type
      delete artwork.category
      return
    }

    if (artwork.type === 'Digital') {
      artwork.mediumType = 'Digital'
    } else if (artwork.type === 'Traditional') {
      artwork.mediumType = 'Traditional'
    } else {
      artwork.mediumType = 'Other'
    }

    delete artwork.type
    delete artwork.category
  })
})

db.version(3).stores({
  folders: 'id, name, createdAt, updatedAt',
  artworks:
    'id, title, mediumType, medium, folderId, status, favorite, artworkDate, createdAt, updatedAt, totalMinutes',
}).upgrade(async (tx) => {
  const artworks = await tx.table('artworks').toArray()
  const collectionNames = new Set()

  for (const artwork of artworks) {
    if (artwork.folderId) continue
    const name = artwork.collection?.trim()
    if (name) collectionNames.add(name)
  }

  const nameToId = new Map()
  const now = new Date().toISOString()

  for (const name of [...collectionNames].sort((a, b) => a.localeCompare(b))) {
    const id = generateId()
    nameToId.set(name.toLowerCase(), id)
    await tx.table('folders').add({
      id,
      name,
      createdAt: now,
      updatedAt: now,
    })
  }

  await tx.table('artworks').toCollection().modify((artwork) => {
    if (artwork.folderId) {
      delete artwork.collection
      return
    }

    const name = artwork.collection?.trim()
    if (name) {
      const folderId = nameToId.get(name.toLowerCase())
      artwork.folderId = folderId || null
    } else {
      artwork.folderId = null
    }

    delete artwork.collection
  })
})

db.version(4).stores({
  folders: 'id, parentFolderId, name, createdAt, updatedAt',
  artworks:
    'id, title, mediumType, medium, folderId, status, favorite, artworkDate, createdAt, updatedAt, totalMinutes',
}).upgrade(async (tx) => {
  await tx.table('folders').toCollection().modify((folder) => {
    if (folder.parentFolderId === undefined) {
      folder.parentFolderId = null
    }
  })
})

db.version(5).stores({
  folders: 'id, parentFolderId, name, createdAt, updatedAt',
  artworks:
    'id, title, mediumType, medium, folderId, status, favorite, artworkDate, createdAt, updatedAt, totalMinutes',
  syncQueue:
    '++id, &[userId+entityType+entityId], userId, entityType, entityId, priority, status, nextRetryAt, updatedAt',
  syncImageHashes: '&id, userId, artworkId',
  syncState: 'userId',
})

db.version(6).stores({
  folders: 'id, parentFolderId, name, createdAt, updatedAt, cloudRevision',
  artworks:
    'id, title, mediumType, medium, folderId, status, favorite, artworkDate, createdAt, updatedAt, totalMinutes, cloudRevision',
  syncQueue:
    '++id, &[userId+entityType+entityId], userId, entityType, entityId, priority, status, nextRetryAt, updatedAt',
  syncImageHashes: '&id, userId, artworkId',
  syncState: 'userId',
  syncConflicts: '&id, userId, entityType, entityId, jobId',
}).upgrade(async (tx) => {
  await tx.table('folders').toCollection().modify((folder) => {
    if (folder.cloudRevision === undefined) {
      folder.cloudRevision = 0
    }
  })
  await tx.table('artworks').toCollection().modify((artwork) => {
    if (artwork.cloudRevision === undefined) {
      artwork.cloudRevision = 0
    }
  })
})
