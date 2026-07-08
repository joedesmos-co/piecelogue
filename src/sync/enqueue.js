import { getActiveSyncUserId } from '../sync/activeUser'
import { SYNC_ENTITY_TYPES, enqueueDeleteSyncJob, enqueueSyncJob } from '../db/syncQueueService'

let wakeHandler = null

export function setSyncWakeHandler(handler) {
  wakeHandler = handler
}

function notifyWake() {
  wakeHandler?.()
}

export async function enqueueFolderDeleteSync(folderId) {
  const userId = getActiveSyncUserId()
  if (!userId || !folderId) {
    return
  }
  await enqueueDeleteSyncJob(userId, SYNC_ENTITY_TYPES.FOLDER_DELETE, folderId)
  notifyWake()
}

export async function enqueueArtworkDeleteSync(artworkId) {
  const userId = getActiveSyncUserId()
  if (!userId || !artworkId) {
    return
  }
  await enqueueDeleteSyncJob(userId, SYNC_ENTITY_TYPES.ARTWORK_DELETE, artworkId)
  notifyWake()
}

export async function enqueueFolderSync(folderId) {
  const userId = getActiveSyncUserId()
  if (!userId || !folderId) {
    return
  }
  await enqueueSyncJob(userId, SYNC_ENTITY_TYPES.FOLDER, folderId)
  notifyWake()
}

export async function enqueueArtworkMetadataSync(artworkId) {
  const userId = getActiveSyncUserId()
  if (!userId || !artworkId) {
    return
  }
  await enqueueSyncJob(userId, SYNC_ENTITY_TYPES.ARTWORK, artworkId)
  notifyWake()
}

export async function enqueueArtworkImageSync(artworkId) {
  const userId = getActiveSyncUserId()
  if (!userId || !artworkId) {
    return
  }
  await enqueueSyncJob(userId, SYNC_ENTITY_TYPES.ARTWORK_IMAGE, artworkId)
  notifyWake()
}

export async function enqueueArtworkSync(artworkId, { includeImage = true } = {}) {
  await enqueueArtworkMetadataSync(artworkId)
  if (includeImage) {
    await enqueueArtworkImageSync(artworkId)
  }
}
