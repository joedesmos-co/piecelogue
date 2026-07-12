import { SYNC_PRIORITIES, SYNC_ENTITY_TYPES } from './constants.js'

export function isDeleteSyncEntityType(entityType) {
  return (
    entityType === SYNC_ENTITY_TYPES.FOLDER_DELETE ||
    entityType === SYNC_ENTITY_TYPES.ARTWORK_DELETE
  )
}

export function buildSyncJobKey(userId, entityType, entityId) {
  return `${userId}:${entityType}:${entityId}`
}

export function buildCoalescedJob(existingJob, { userId, entityType, entityId, now }) {
  if (existingJob?.status === 'processing') {
    return {
      ...existingJob,
      updatedAt: now,
    }
  }

  const base = {
    userId,
    entityType,
    entityId,
    priority: SYNC_PRIORITIES[entityType],
    status: 'pending',
    attempts: 0,
    lastError: null,
    nextRetryAt: null,
    processingStartedAt: null,
    updatedAt: now,
  }

  if (!existingJob) {
    return {
      ...base,
      createdAt: now,
    }
  }

  return {
    ...existingJob,
    ...base,
    createdAt: existingJob.createdAt || now,
  }
}

export function sortSyncJobs(jobs) {
  return [...jobs].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
}

export function isJobReady(job, now = Date.now()) {
  if (job.status === 'failed' || job.status === 'conflict' || job.status === 'processing') {
    return false
  }
  if (!job.nextRetryAt) {
    return true
  }
  return new Date(job.nextRetryAt).getTime() <= now
}

export function filterJobsForActiveUser(jobs, activeUserId) {
  if (!activeUserId) {
    return []
  }
  return jobs.filter((job) => job.userId === activeUserId)
}
