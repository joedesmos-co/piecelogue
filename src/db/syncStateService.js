import { db } from './database'

export async function getSyncState(userId) {
  if (!userId) {
    return null
  }
  return db.syncState.get(userId)
}

export async function markLibrarySeeded(userId) {
  const now = new Date().toISOString()
  const existing = await getSyncState(userId)

  await db.syncState.put({
    userId,
    librarySeededAt: existing?.librarySeededAt || now,
    lastSyncedAt: existing?.lastSyncedAt ?? null,
    updatedAt: now,
  })
}

export async function setLastSyncedAt(userId, timestamp = new Date().toISOString()) {
  const existing = (await getSyncState(userId)) || { userId }

  await db.syncState.put({
    ...existing,
    userId,
    lastSyncedAt: timestamp,
    updatedAt: timestamp,
  })
}

export async function isLibrarySeeded(userId) {
  const state = await getSyncState(userId)
  return Boolean(state?.librarySeededAt)
}

export async function clearSyncStateForUser(userId) {
  await db.syncState.delete(userId)
}
