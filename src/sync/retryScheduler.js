import { SYNC_JOB_STATUS } from './constants.js'

export const STUCK_PROCESSING_THRESHOLD_MS = 2 * 60 * 1000

let retryTimerId = null

export function scheduleRetryWake(jobs, wakeFn) {
  if (retryTimerId) {
    clearTimeout(retryTimerId)
    retryTimerId = null
  }

  const now = Date.now()
  let nextWakeAt = null

  for (const job of jobs) {
    if (job.status !== SYNC_JOB_STATUS.PENDING || !job.nextRetryAt) {
      continue
    }

    const retryAt = new Date(job.nextRetryAt).getTime()
    if (Number.isNaN(retryAt) || retryAt <= now) {
      continue
    }

    if (nextWakeAt === null || retryAt < nextWakeAt) {
      nextWakeAt = retryAt
    }
  }

  if (nextWakeAt === null) {
    return
  }

  const delay = Math.max(0, nextWakeAt - now) + 50
  retryTimerId = setTimeout(() => {
    retryTimerId = null
    wakeFn()
  }, delay)
}

export function clearRetryScheduler() {
  if (retryTimerId) {
    clearTimeout(retryTimerId)
    retryTimerId = null
  }
}

export function getStuckProcessingJobsToRecover(
  jobs,
  thresholdMs = STUCK_PROCESSING_THRESHOLD_MS,
  now = Date.now(),
) {
  return jobs.filter((job) => {
    if (job.status !== SYNC_JOB_STATUS.PROCESSING || !job.processingStartedAt) {
      return false
    }

    const startedAt = new Date(job.processingStartedAt).getTime()
    return !Number.isNaN(startedAt) && now - startedAt > thresholdMs
  })
}

export async function recoverStuckProcessingJobs(
  userId,
  thresholdMs = STUCK_PROCESSING_THRESHOLD_MS,
  now = Date.now(),
  deps = {},
) {
  if (!userId) {
    return 0
  }

  const getJobs = deps.getJobs ?? (async (id) => {
    const { getSyncJobsForUser } = await import('../db/syncQueueService.js')
    return getSyncJobsForUser(id)
  })
  const updateJob = deps.updateJob ?? (async (jobId, update) => {
    const { updateSyncJob } = await import('../db/syncQueueService.js')
    return updateSyncJob(jobId, update)
  })

  const jobs = await getJobs(userId)
  const stuckJobs = getStuckProcessingJobsToRecover(jobs, thresholdMs, now)
  let recovered = 0

  for (const job of stuckJobs) {
    await updateJob(job.id, {
      status: SYNC_JOB_STATUS.PENDING,
      processingStartedAt: null,
      lastError: 'Sync was interrupted and will retry.',
    })
    recovered += 1
  }

  return recovered
}
