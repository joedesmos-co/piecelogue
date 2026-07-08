import { getActiveSyncUserId } from '../sync/activeUser'
import { SYNC_ENTITY_TYPES, enqueueSyncJob } from '../db/syncQueueService'

let wakeHandler = null

export function setSyncWakeHandler(handler) {
  wakeHandler = handler
}

function notifyWake() {
  wakeHandler?.()
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
