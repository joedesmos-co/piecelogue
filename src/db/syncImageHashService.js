import { db } from './database'
import { buildImageHashRecordId } from '../sync/imageHash'

export async function getImageHashes(userId, artworkId) {
  const id = buildImageHashRecordId(userId, artworkId)
  return db.syncImageHashes.get(id)
}

export async function getImageHashesForUser(userId) {
  if (!userId) {
    return []
  }
  return db.syncImageHashes.where('userId').equals(userId).toArray()
}

export async function setImageHashes(userId, artworkId, { originalHash, thumbnailHash }) {
  const id = buildImageHashRecordId(userId, artworkId)
  const now = new Date().toISOString()
  const existing = await db.syncImageHashes.get(id)

  await db.syncImageHashes.put({
    id,
    userId,
    artworkId,
    originalHash: originalHash ?? existing?.originalHash ?? null,
    thumbnailHash: thumbnailHash ?? existing?.thumbnailHash ?? null,
    updatedAt: now,
  })
}

export async function clearImageHashesForUser(userId) {
  await db.syncImageHashes.where('userId').equals(userId).delete()
}
