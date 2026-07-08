import { db } from './database'

function conflictKey(userId, entityType, entityId) {
  return `${userId}:${entityType}:${entityId}`
}

export async function saveSyncConflict({
  userId,
  entityType,
  entityId,
  jobId = null,
  baseRevision = 0,
  cloudRevision = 0,
  local = null,
  cloud = null,
}) {
  const id = conflictKey(userId, entityType, entityId)
  const now = new Date().toISOString()

  await db.syncConflicts.put({
    id,
    userId,
    entityType,
    entityId,
    jobId,
    baseRevision,
    cloudRevision,
    local,
    cloud,
    createdAt: now,
    updatedAt: now,
  })
}

export async function getSyncConflictsForUser(userId) {
  if (!userId) {
    return []
  }
  return db.syncConflicts.where('userId').equals(userId).toArray()
}

export async function getSyncConflict(userId, entityType, entityId) {
  const id = conflictKey(userId, entityType, entityId)
  return db.syncConflicts.get(id)
}

export async function removeSyncConflict(userId, entityType, entityId) {
  const id = conflictKey(userId, entityType, entityId)
  await db.syncConflicts.delete(id)
}

export async function clearSyncConflictsForUser(userId) {
  await db.syncConflicts.where('userId').equals(userId).delete()
}
