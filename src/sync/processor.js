import * as artworkService from '../db/artworkService'
import * as folderService from '../db/folderService'
import { db } from '../db/database'
import {
  getSyncJobsForUser,
  removeSyncJob,
  resetFailedJobsForUser,
  seedLibrarySyncQueue,
  updateSyncJob,
} from '../db/syncQueueService'
import { clearImageHashes, getImageHashes, setImageHashes } from '../db/syncImageHashService'
import {
  getSyncState,
  isLibrarySeeded,
  markLibrarySeeded,
  setLastSyncedAt,
} from '../db/syncStateService'
import { getSyncConflictsForUser } from '../db/syncConflictService'
import { saveSyncConflict } from '../db/syncConflictService'
import { setArtworkCloudRevision, setFolderCloudRevision } from '../db/syncRevisionService'
import {
  deleteCloudArtwork,
  deleteCloudFolder,
  uploadCloudArtworkOriginal,
  uploadCloudArtworkThumbnail,
  uploadCloudArtworks,
  uploadCloudFolders,
} from '../api/cloud'
import { assertActiveUserScope, getActiveSyncUserId } from './activeUser'
import { toCloudArtworkMetadata, toCloudFolder } from './cloudPayload'
import { snapshotArtwork, snapshotFolder } from './conflictLogic'
import { extractUpsertRevision } from './conflictResolutionCore.js'
import {
  MAX_IMAGE_UPLOAD_CONCURRENCY,
  SYNC_ENTITY_TYPES,
  SYNC_JOB_STATUS,
} from './constants'
import { hashBlob, shouldUploadImage } from './imageHash'
import { prepareBlobForUpload } from './imageUpload'
import { createUploadRequestId } from './uploadDiagnostics'
import { filterJobsForActiveUser, isJobReady, sortSyncJobs } from './queueLogic'
import { buildRetryUpdate } from './retry'
import { recoverStuckProcessingJobs, scheduleRetryWake } from './retryScheduler'
import {
  isForceSyncActive,
  releaseArtworkUpload,
  shouldPauseBackgroundProcessor,
  tryAcquireArtworkUpload,
} from './syncLock'
import { summarizeSyncFailures } from './statusDetails'
import { getFullImageBlob, getGalleryImageBlob } from '../utils/imageUtils'

let processorRunning = false
let processorAbort = false
let wakeProcessor = null
let statusListener = null
let activeUploadDetail = null
let activeBackgroundJobCount = 0
const backgroundIdleWaiters = new Set()

export function setSyncStatusListener(listener) {
  statusListener = listener
}

function emitStatus(partial) {
  statusListener?.(partial)
}

function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

export function wakeSyncProcessor() {
  wakeProcessor?.()
}

export function getActiveUploadDetail() {
  return activeUploadDetail
}

function notifyBackgroundIdle() {
  if (activeBackgroundJobCount !== 0) {
    return
  }
  for (const resolve of backgroundIdleWaiters) {
    resolve()
  }
  backgroundIdleWaiters.clear()
}

export function waitForBackgroundProcessorIdle(signal, timeoutMs = 95_000) {
  if (activeBackgroundJobCount === 0) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    let timeoutId = null

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      signal?.removeEventListener('abort', handleAbort)
      backgroundIdleWaiters.delete(handleIdle)
    }
    const handleIdle = () => {
      cleanup()
      resolve()
    }
    const handleAbort = () => {
      cleanup()
      const error = new Error('Sync cancelled.')
      error.code = 'cancelled'
      reject(error)
    }

    backgroundIdleWaiters.add(handleIdle)
    if (signal?.aborted) {
      handleAbort()
      return
    }
    signal?.addEventListener('abort', handleAbort, { once: true })
    timeoutId = setTimeout(() => {
      cleanup()
      const error = new Error('Background sync did not stop in time.')
      error.code = 'timeout'
      reject(error)
    }, timeoutMs)
  })
}

function setActiveUploadDetail(detail) {
  activeUploadDetail = detail
}

async function processFolderDeleteJob(job) {
  await deleteCloudFolder(job.entityId)
}

async function processArtworkDeleteJob(job) {
  await deleteCloudArtwork(job.entityId)
  await clearImageHashes(job.userId, job.entityId)
}

async function markMetadataConflict(job, entityType, localRecord, conflictEntry) {
  await saveSyncConflict({
    userId: job.userId,
    entityType,
    entityId: job.entityId,
    jobId: job.id,
    baseRevision: conflictEntry.baseRevision,
    cloudRevision: conflictEntry.cloudRevision,
    local: localRecord,
    cloud: conflictEntry.cloud,
  })
  await updateSyncJob(job.id, {
    status: SYNC_JOB_STATUS.CONFLICT,
    lastError: 'Sync conflict — review needed.',
    processingStartedAt: null,
  })
  await publishStatus(job.userId)
}

async function applyMetadataRevision(entityType, entityId, response) {
  const revision = extractUpsertRevision(response, entityId)
  if (!revision) {
    return
  }

  if (entityType === SYNC_ENTITY_TYPES.FOLDER) {
    await setFolderCloudRevision(entityId, revision)
  } else {
    await setArtworkCloudRevision(entityId, revision)
  }
}

async function processFolderJob(job) {
  const folder = await db.folders.get(job.entityId)
  if (!folder) {
    await removeSyncJob(job.id)
    return false
  }

  const response = await uploadCloudFolders([toCloudFolder(folder)])
  const conflictEntry = response.conflicts?.find((entry) => entry.id === job.entityId)
  if (conflictEntry) {
    await markMetadataConflict(job, SYNC_ENTITY_TYPES.FOLDER, snapshotFolder(folder), conflictEntry)
    return true
  }

  await applyMetadataRevision(SYNC_ENTITY_TYPES.FOLDER, job.entityId, response)
  return false
}

async function processArtworkJob(job) {
  const artwork = await db.artworks.get(job.entityId)
  if (!artwork) {
    await removeSyncJob(job.id)
    return false
  }

  const response = await uploadCloudArtworks([toCloudArtworkMetadata(artwork)])
  const conflictEntry = response.conflicts?.find((entry) => entry.id === job.entityId)
  if (conflictEntry) {
    await markMetadataConflict(job, SYNC_ENTITY_TYPES.ARTWORK, snapshotArtwork(artwork), conflictEntry)
    return true
  }

  await applyMetadataRevision(SYNC_ENTITY_TYPES.ARTWORK, job.entityId, response)
  return false
}

async function uploadArtworkImageStage(artwork, stage, blob, storedHash, job) {
  const uploadDetails = {
    stage,
    artworkTitle: artwork.title,
    artworkId: artwork.id,
  }

  const prepared = await prepareBlobForUpload(blob, uploadDetails)
  const requestId = createUploadRequestId()
  setActiveUploadDetail({
    artworkId: artwork.id,
    artworkTitle: artwork.title,
    stage,
    requestId,
    mimeType: prepared.mimeType,
    format: prepared.format,
    blobSize: prepared.blobSize,
    byteSize: prepared.byteSize,
    exceedsLimit: prepared.exceedsLimit,
  })
  await publishStatus(job.userId)

  if (stage === 'original') {
    await uploadCloudArtworkOriginal(artwork.id, prepared.body, {
      contentType: prepared.mimeType,
      requestId,
      ...prepared,
    })
    return blob ? await hashBlob(blob) : storedHash
  }

  await uploadCloudArtworkThumbnail(artwork.id, prepared.body, {
    contentType: prepared.mimeType,
    requestId,
    ...prepared,
  })
  return blob ? await hashBlob(blob) : storedHash
}

async function processArtworkImageJob(job) {
  const artwork = await artworkService.getArtworkById(job.entityId)
  if (!artwork) {
    await removeSyncJob(job.id)
    return
  }

  const stored = await getImageHashes(job.userId, job.entityId)
  const originalBlob = getFullImageBlob(artwork)
  const thumbnailBlob = getGalleryImageBlob(artwork)

  const originalHash = originalBlob ? await hashBlob(originalBlob) : null
  const thumbnailHash = thumbnailBlob ? await hashBlob(thumbnailBlob) : null

  let uploadedOriginalHash = stored?.originalHash ?? null
  let uploadedThumbnailHash = stored?.thumbnailHash ?? null

  if (shouldUploadImage(originalHash, stored?.originalHash) && originalBlob) {
    uploadedOriginalHash = await uploadArtworkImageStage(
      artwork,
      'original',
      originalBlob,
      uploadedOriginalHash,
      job,
    )
  }

  if (shouldUploadImage(thumbnailHash, stored?.thumbnailHash) && thumbnailBlob) {
    uploadedThumbnailHash = await uploadArtworkImageStage(
      artwork,
      'thumbnail',
      thumbnailBlob,
      uploadedThumbnailHash,
      job,
    )
  }

  if (uploadedOriginalHash || uploadedThumbnailHash) {
    await setImageHashes(job.userId, artwork.id, {
      originalHash: uploadedOriginalHash,
      thumbnailHash: uploadedThumbnailHash,
    })
  }
}

async function processJob(job) {
  switch (job.entityType) {
    case SYNC_ENTITY_TYPES.FOLDER_DELETE:
      await processFolderDeleteJob(job)
      return false
    case SYNC_ENTITY_TYPES.ARTWORK_DELETE:
      await processArtworkDeleteJob(job)
      return false
    case SYNC_ENTITY_TYPES.FOLDER:
      return processFolderJob(job)
    case SYNC_ENTITY_TYPES.ARTWORK:
      return processArtworkJob(job)
    case SYNC_ENTITY_TYPES.ARTWORK_IMAGE:
      await processArtworkImageJob(job)
      return false
    default:
      throw new Error(`Unknown sync entity type: ${job.entityType}`)
  }
}

async function runWithConcurrency(jobs, limit, handler) {
  const queue = [...jobs]
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      if (processorAbort || shouldPauseBackgroundProcessor()) {
        return
      }
      const job = queue.shift()
      if (job) {
        await handler(job)
      }
    }
  })

  await Promise.all(workers)
}

async function processReadyJobs(userId) {
  const allJobs = await getSyncJobsForUser(userId)
  const scopedJobs = filterJobsForActiveUser(allJobs, getActiveSyncUserId())
  const readyJobs = sortSyncJobs(
    scopedJobs.filter(
      (job) =>
        job.status === SYNC_JOB_STATUS.PENDING && isJobReady(job),
    ),
  )

  const deleteJobs = readyJobs.filter(
    (job) =>
      job.entityType === SYNC_ENTITY_TYPES.FOLDER_DELETE ||
      job.entityType === SYNC_ENTITY_TYPES.ARTWORK_DELETE,
  )
  const folderJobs = readyJobs.filter((job) => job.entityType === SYNC_ENTITY_TYPES.FOLDER)
  const artworkJobs = readyJobs.filter((job) => job.entityType === SYNC_ENTITY_TYPES.ARTWORK)
  const imageJobs = readyJobs.filter((job) => job.entityType === SYNC_ENTITY_TYPES.ARTWORK_IMAGE)

  const handleJob = async (job) => {
    if (processorAbort || !assertActiveUserScope(job.userId) || shouldPauseBackgroundProcessor()) {
      return
    }

    const isImageJob = job.entityType === SYNC_ENTITY_TYPES.ARTWORK_IMAGE
    if (isImageJob && !tryAcquireArtworkUpload(job.entityId, 'background')) {
      return
    }

    if (processorAbort || shouldPauseBackgroundProcessor()) {
      if (isImageJob) {
        releaseArtworkUpload(job.entityId)
      }
      return
    }

    activeBackgroundJobCount += 1
    try {
      await updateSyncJob(job.id, {
        status: SYNC_JOB_STATUS.PROCESSING,
        processingStartedAt: new Date().toISOString(),
      })
      const conflicted = await processJob(job)
      if (conflicted) {
        return
      }
      await removeSyncJob(job.id)
    } catch (error) {
      const updates = buildRetryUpdate(job, error)
      await updateSyncJob(job.id, updates)
      if (updates.status === SYNC_JOB_STATUS.FAILED) {
        await publishStatus(job.userId)
      }
      throw error
    } finally {
      if (isImageJob) {
        setActiveUploadDetail(null)
        releaseArtworkUpload(job.entityId)
      }
      activeBackgroundJobCount = Math.max(0, activeBackgroundJobCount - 1)
      notifyBackgroundIdle()
    }
  }

  for (const job of deleteJobs) {
    if (processorAbort || shouldPauseBackgroundProcessor()) return
    await handleJob(job).catch(() => {})
  }

  for (const job of folderJobs) {
    if (processorAbort || shouldPauseBackgroundProcessor()) return
    await handleJob(job).catch(() => {})
  }

  for (const job of artworkJobs) {
    if (processorAbort || shouldPauseBackgroundProcessor()) return
    await handleJob(job).catch(() => {})
  }

  await runWithConcurrency(imageJobs, MAX_IMAGE_UPLOAD_CONCURRENCY, async (job) => {
    if (processorAbort || shouldPauseBackgroundProcessor()) return
    await handleJob(job).catch(() => {})
  })

  if (deleteJobs.length + folderJobs.length + artworkJobs.length + imageJobs.length > 0) {
    await setLastSyncedAt(userId)
  }
}

function countPendingDeleteJobs(jobs) {
  return jobs.filter(
    (job) =>
      (job.status === SYNC_JOB_STATUS.PENDING || job.status === SYNC_JOB_STATUS.FAILED) &&
      (job.entityType === SYNC_ENTITY_TYPES.FOLDER_DELETE ||
        job.entityType === SYNC_ENTITY_TYPES.ARTWORK_DELETE),
  ).length
}

async function buildStatus(userId) {
  if (!userId) {
    return {
      state: 'signed-out',
      pendingCount: 0,
      pendingDeleteCount: 0,
      conflictCount: 0,
      lastSyncedAt: null,
      error: null,
      failures: [],
      activeUpload: null,
      forceSyncActive: false,
    }
  }

  const jobs = await getSyncJobsForUser(userId)
  const conflicts = await getSyncConflictsForUser(userId)
  const pendingJobs = jobs.filter((job) => job.status === SYNC_JOB_STATUS.PENDING)
  const processingJobs = jobs.filter((job) => job.status === SYNC_JOB_STATUS.PROCESSING)
  const failedJobs = jobs.filter((job) => job.status === SYNC_JOB_STATUS.FAILED)
  const conflictJobs = jobs.filter((job) => job.status === SYNC_JOB_STATUS.CONFLICT)
  const conflictCount = Math.max(conflictJobs.length, conflicts.length)
  const readyCount = pendingJobs.filter((job) => isJobReady(job)).length
  const waitingRetryCount = pendingJobs.length - readyCount
  const state = await getSyncState(userId)

  const pendingDeleteCount = countPendingDeleteJobs(jobs)
  const failures = summarizeSyncFailures(jobs)
  const forceSyncActive = isForceSyncActive()
  const activeUpload = activeUploadDetail

  if (forceSyncActive) {
    return {
      state: 'syncing',
      pendingCount: pendingJobs.length + processingJobs.length,
      pendingDeleteCount,
      conflictCount: 0,
      lastSyncedAt: state?.lastSyncedAt ?? null,
      error: null,
      failures: [],
      activeUpload,
      forceSyncActive: true,
    }
  }

  if (!isOnline()) {
    return {
      state: conflictCount > 0 ? 'conflict' : 'offline',
      pendingCount: pendingJobs.length + failedJobs.length + processingJobs.length,
      pendingDeleteCount,
      conflictCount,
      lastSyncedAt: state?.lastSyncedAt ?? null,
      error: failedJobs[0]?.lastError ?? null,
      failures,
      activeUpload,
      forceSyncActive: false,
    }
  }

  if (conflictCount > 0) {
    return {
      state: 'conflict',
      pendingCount: pendingJobs.length + failedJobs.length + conflictJobs.length + processingJobs.length,
      pendingDeleteCount,
      conflictCount,
      lastSyncedAt: state?.lastSyncedAt ?? null,
      error: null,
      failures,
      activeUpload,
      forceSyncActive: false,
    }
  }

  if (failedJobs.length > 0) {
    return {
      state: 'error',
      pendingCount: pendingJobs.length + failedJobs.length + processingJobs.length,
      pendingDeleteCount,
      conflictCount: 0,
      lastSyncedAt: state?.lastSyncedAt ?? null,
      error: failedJobs[0]?.lastError ?? 'Sync failed.',
      failures,
      activeUpload,
      forceSyncActive: false,
    }
  }

  if (processorRunning && (readyCount > 0 || processingJobs.length > 0 || activeUpload)) {
    return {
      state: 'syncing',
      pendingCount: pendingJobs.length + processingJobs.length,
      pendingDeleteCount,
      conflictCount: 0,
      lastSyncedAt: state?.lastSyncedAt ?? null,
      error: null,
      failures: [],
      activeUpload,
      forceSyncActive: false,
    }
  }

  if (pendingJobs.length > 0 || processingJobs.length > 0) {
    return {
      state: waitingRetryCount > 0 && readyCount === 0 && processingJobs.length === 0 ? 'waiting' : 'pending',
      pendingCount: pendingJobs.length + processingJobs.length,
      pendingDeleteCount,
      conflictCount: 0,
      lastSyncedAt: state?.lastSyncedAt ?? null,
      error: pendingJobs.find((job) => job.lastError)?.lastError ?? null,
      failures: [],
      activeUpload,
      forceSyncActive: false,
    }
  }

  return {
    state: 'up-to-date',
    pendingCount: 0,
    pendingDeleteCount: 0,
    conflictCount: 0,
    lastSyncedAt: state?.lastSyncedAt ?? null,
    error: null,
    failures: [],
    activeUpload: null,
    forceSyncActive: false,
  }
}

async function publishStatus(userId) {
  const jobs = userId ? await getSyncJobsForUser(userId) : []
  scheduleRetryWake(jobs, wakeSyncProcessor)
  emitStatus(await buildStatus(userId))
}

export async function seedInitialLibrarySync(userId) {
  if (!userId || (await isLibrarySeeded(userId))) {
    return false
  }

  const [folders, artworks] = await Promise.all([
    folderService.getAllFolders(),
    artworkService.getAllArtworks(),
  ])

  await seedLibrarySyncQueue(userId, folders, artworks)
  await markLibrarySeeded(userId)
  return true
}

export async function retryFailedSync(userId) {
  if (!userId) {
    return
  }
  await resetFailedJobsForUser(userId)
  wakeSyncProcessor()
}

export function stopSyncProcessor() {
  processorAbort = true
  processorRunning = false
  wakeProcessor = null
  setActiveUploadDetail(null)
}

export function startSyncProcessor(userId) {
  if (!userId) {
    return () => {}
  }

  processorAbort = false

  const run = async () => {
    if (processorRunning) {
      return
    }

    processorRunning = true
    try {
      while (!processorAbort) {
        if (!getActiveSyncUserId() || getActiveSyncUserId() !== userId) {
          break
        }

        if (shouldPauseBackgroundProcessor()) {
          await publishStatus(userId)
          await new Promise((resolve) => {
            wakeProcessor = resolve
          })
          continue
        }

        if (!isOnline()) {
          await publishStatus(userId)
          await new Promise((resolve) => {
            wakeProcessor = resolve
          })
          continue
        }

        await publishStatus(userId)
        await processReadyJobs(userId)
        await publishStatus(userId)

        const jobs = await getSyncJobsForUser(userId)
        scheduleRetryWake(jobs, wakeSyncProcessor)
        const hasReadyWork = jobs.some(
          (job) =>
            job.userId === userId &&
            job.status === SYNC_JOB_STATUS.PENDING &&
            isJobReady(job),
        )

        if (!hasReadyWork) {
          await new Promise((resolve) => {
            wakeProcessor = resolve
          })
          continue
        }
      }
    } finally {
      processorRunning = false
      setActiveUploadDetail(null)
    }
  }

  run().catch(() => {
    processorRunning = false
    setActiveUploadDetail(null)
  })

  return () => {
    processorAbort = true
    wakeProcessor?.()
  }
}

export async function refreshSyncStatus(userId) {
  const status = await buildStatus(userId)
  emitStatus(status)
  return status
}

export async function recoverSyncJobs(userId) {
  return recoverStuckProcessingJobs(userId)
}

export async function recordForceSyncComplete(userId, artworks) {
  if (!userId) {
    return
  }

  await markLibrarySeeded(userId)
  await setLastSyncedAt(userId)

  for (const artwork of artworks) {
    const originalBlob = getFullImageBlob(artwork)
    const thumbnailBlob = getGalleryImageBlob(artwork)
    const originalHash = originalBlob ? await hashBlob(originalBlob) : null
    const thumbnailHash = thumbnailBlob ? await hashBlob(thumbnailBlob) : null

    if (originalHash || thumbnailHash) {
      await setImageHashes(userId, artwork.id, { originalHash, thumbnailHash })
    }
  }
}

export { isForceSyncActive }
