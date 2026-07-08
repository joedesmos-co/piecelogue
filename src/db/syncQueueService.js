import { db } from './database'
import { SYNC_ENTITY_TYPES, SYNC_JOB_STATUS } from '../sync/constants'
import { buildCoalescedJob } from '../sync/queueLogic'

function compoundKey(userId, entityType, entityId) {
  return [userId, entityType, entityId]
}

export async function getSyncJob(userId, entityType, entityId) {
  return db.syncQueue
    .where('[userId+entityType+entityId]')
    .equals(compoundKey(userId, entityType, entityId))
    .first()
}

export async function clearUpsertJobsForFolder(userId, folderId) {
  await db.syncQueue
    .where('[userId+entityType+entityId]')
    .equals(compoundKey(userId, SYNC_ENTITY_TYPES.FOLDER, folderId))
    .delete()
}

export async function clearUpsertJobsForArtwork(userId, artworkId) {
  await db.syncQueue
    .where('[userId+entityType+entityId]')
    .equals(compoundKey(userId, SYNC_ENTITY_TYPES.ARTWORK, artworkId))
    .delete()

  await db.syncQueue
    .where('[userId+entityType+entityId]')
    .equals(compoundKey(userId, SYNC_ENTITY_TYPES.ARTWORK_IMAGE, artworkId))
    .delete()
}

export async function enqueueDeleteSyncJob(userId, entityType, entityId) {
  if (!userId || !entityType || !entityId) {
    return null
  }

  if (entityType === SYNC_ENTITY_TYPES.ARTWORK_DELETE) {
    await clearUpsertJobsForArtwork(userId, entityId)
  } else if (entityType === SYNC_ENTITY_TYPES.FOLDER_DELETE) {
    await clearUpsertJobsForFolder(userId, entityId)
  }

  return enqueueSyncJob(userId, entityType, entityId)
}

export async function enqueueSyncJob(userId, entityType, entityId) {
  if (!userId || !entityType || !entityId) {
    return null
  }

  const now = new Date().toISOString()
  const existing = await getSyncJob(userId, entityType, entityId)
  const job = buildCoalescedJob(existing, { userId, entityType, entityId, now })

  if (existing?.id) {
    await db.syncQueue.put({ ...job, id: existing.id })
    return { ...job, id: existing.id }
  }

  const id = await db.syncQueue.add(job)
  return { ...job, id }
}

export async function removeSyncJob(jobId) {
  await db.syncQueue.delete(jobId)
}

export async function updateSyncJob(jobId, updates) {
  await db.syncQueue.update(jobId, {
    ...updates,
    updatedAt: new Date().toISOString(),
  })
}

export async function getSyncJobsForUser(userId) {
  if (!userId) {
    return []
  }
  return db.syncQueue.where('userId').equals(userId).toArray()
}

export async function getPendingSyncCount(userId) {
  const jobs = await getSyncJobsForUser(userId)
  return jobs.filter(
    (job) => job.status === SYNC_JOB_STATUS.PENDING || job.status === SYNC_JOB_STATUS.FAILED,
  ).length
}

export async function resetFailedJobsForUser(userId) {
  const jobs = await getSyncJobsForUser(userId)
  const now = new Date().toISOString()

  await db.transaction('rw', db.syncQueue, async () => {
    for (const job of jobs) {
      if (job.status === SYNC_JOB_STATUS.FAILED) {
        await db.syncQueue.update(job.id, {
          status: SYNC_JOB_STATUS.PENDING,
          attempts: 0,
          lastError: null,
          nextRetryAt: null,
          updatedAt: now,
        })
      }
    }
  })
}

export async function clearSyncQueueForUser(userId) {
  await db.syncQueue.where('userId').equals(userId).delete()
}

export async function seedLibrarySyncQueue(userId, folders, artworks) {
  for (const folder of folders) {
    await enqueueSyncJob(userId, SYNC_ENTITY_TYPES.FOLDER, folder.id)
  }

  for (const artwork of artworks) {
    await enqueueSyncJob(userId, SYNC_ENTITY_TYPES.ARTWORK, artwork.id)
    await enqueueSyncJob(userId, SYNC_ENTITY_TYPES.ARTWORK_IMAGE, artwork.id)
  }
}

export { SYNC_ENTITY_TYPES }
