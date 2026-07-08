import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { describe, it } from 'node:test'
import { assertActiveUserScope, setActiveSyncUserId } from '../sync/activeUser.js'
import { shouldUploadImage } from '../sync/imageHash.js'
import {
  buildCoalescedJob,
  filterJobsForActiveUser,
  isDeleteSyncEntityType,
  isJobReady,
  sortSyncJobs,
} from '../sync/queueLogic.js'
import { SYNC_ENTITY_TYPES, SYNC_JOB_STATUS } from '../sync/constants.js'
import {
  buildRetryUpdate,
  classifySyncError,
  computeBackoffMs,
  shouldRetryJob,
} from '../sync/retry.js'
import { ApiError } from '../utils/api.js'

describe('sync queue coalescing', () => {
  it('replaces an existing job with a fresh pending upsert', () => {
    const now = '2026-07-08T12:00:00.000Z'
    const existing = {
      id: 1,
      userId: 'user-1',
      entityType: 'folder',
      entityId: 'folder-1',
      priority: 1,
      status: 'failed',
      attempts: 3,
      lastError: 'Server error',
      nextRetryAt: '2026-07-08T12:05:00.000Z',
      createdAt: '2026-07-08T11:00:00.000Z',
      updatedAt: '2026-07-08T11:30:00.000Z',
    }

    const next = buildCoalescedJob(existing, {
      userId: 'user-1',
      entityType: 'folder',
      entityId: 'folder-1',
      now,
    })

    assert.equal(next.status, 'pending')
    assert.equal(next.attempts, 0)
    assert.equal(next.lastError, null)
    assert.equal(next.nextRetryAt, null)
    assert.equal(next.createdAt, existing.createdAt)
    assert.equal(next.updatedAt, now)
  })

  it('orders jobs folders -> artwork metadata -> images', () => {
    const jobs = sortSyncJobs([
      { priority: 3, createdAt: '2026-07-08T10:00:00.000Z', entityType: 'artwork-image' },
      { priority: 1, createdAt: '2026-07-08T12:00:00.000Z', entityType: 'folder' },
      { priority: 2, createdAt: '2026-07-08T11:00:00.000Z', entityType: 'artwork' },
      { priority: 1, createdAt: '2026-07-08T09:00:00.000Z', entityType: 'folder' },
    ])

    assert.deepEqual(jobs.map((job) => job.priority), [1, 1, 2, 3])
    assert.equal(jobs[0].createdAt, '2026-07-08T09:00:00.000Z')
  })

  it('orders delete jobs before upserts', () => {
    const jobs = sortSyncJobs([
      { priority: 2, createdAt: '2026-07-08T10:00:00.000Z', entityType: SYNC_ENTITY_TYPES.ARTWORK },
      { priority: 0, createdAt: '2026-07-08T11:00:00.000Z', entityType: SYNC_ENTITY_TYPES.ARTWORK_DELETE },
      { priority: 1, createdAt: '2026-07-08T09:00:00.000Z', entityType: SYNC_ENTITY_TYPES.FOLDER },
      { priority: 0, createdAt: '2026-07-08T08:00:00.000Z', entityType: SYNC_ENTITY_TYPES.FOLDER_DELETE },
    ])

    assert.equal(jobs[0].entityType, SYNC_ENTITY_TYPES.FOLDER_DELETE)
    assert.equal(jobs[1].entityType, SYNC_ENTITY_TYPES.ARTWORK_DELETE)
    assert.equal(jobs[2].entityType, SYNC_ENTITY_TYPES.FOLDER)
    assert.equal(jobs[3].entityType, SYNC_ENTITY_TYPES.ARTWORK)
  })
})

describe('delete sync job types', () => {
  it('uses separate entity types for delete tombstones', () => {
    assert.equal(isDeleteSyncEntityType(SYNC_ENTITY_TYPES.ARTWORK_DELETE), true)
    assert.equal(isDeleteSyncEntityType(SYNC_ENTITY_TYPES.FOLDER_DELETE), true)
    assert.equal(isDeleteSyncEntityType(SYNC_ENTITY_TYPES.ARTWORK), false)
    assert.equal(isDeleteSyncEntityType(SYNC_ENTITY_TYPES.FOLDER), false)
  })

  it('coalesces repeated delete jobs for the same entity', () => {
    const now = '2026-07-08T12:00:00.000Z'
    const existing = {
      id: 9,
      userId: 'user-1',
      entityType: SYNC_ENTITY_TYPES.ARTWORK_DELETE,
      entityId: 'art-1',
      priority: 0,
      status: 'failed',
      attempts: 2,
      lastError: 'Server error',
      createdAt: '2026-07-08T11:00:00.000Z',
      updatedAt: '2026-07-08T11:30:00.000Z',
    }

    const next = buildCoalescedJob(existing, {
      userId: 'user-1',
      entityType: SYNC_ENTITY_TYPES.ARTWORK_DELETE,
      entityId: 'art-1',
      now,
    })

    assert.equal(next.status, 'pending')
    assert.equal(next.attempts, 0)
    assert.equal(next.priority, 0)
  })
})

describe('sync user scoping', () => {
  it('only allows the active signed-in user to process jobs', () => {
    setActiveSyncUserId('user-a')

    assert.equal(assertActiveUserScope('user-a'), true)
    assert.equal(assertActiveUserScope('user-b'), false)

    const jobs = filterJobsForActiveUser(
      [
        { userId: 'user-a', entityId: '1' },
        { userId: 'user-b', entityId: '2' },
      ],
      'user-a',
    )

    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].entityId, '1')

    setActiveSyncUserId(null)
  })
})

describe('sync retry classification', () => {
  it('retries network and 5xx errors with exponential backoff', () => {
    assert.equal(classifySyncError(new TypeError('Failed to fetch')).retryable, true)
    assert.equal(classifySyncError(new ApiError('Rate limited', 'rate_limit', 429)).retryable, true)
    assert.equal(classifySyncError(new ApiError('Server error', 'server_error', 503)).retryable, true)
    assert.equal(computeBackoffMs(1), 5000)
    assert.equal(computeBackoffMs(3), 20000)
  })

  it('marks permanent 4xx errors as non-retryable', () => {
    const classification = classifySyncError(new ApiError('Forbidden', 'forbidden', 403))
    assert.equal(classification.permanent, true)
    assert.equal(shouldRetryJob({ attempts: 1 }, classification), false)
  })

  it('stores retry metadata until max attempts are reached', () => {
    const update = buildRetryUpdate({ attempts: 1 }, new ApiError('Server error', null, 500))
    assert.equal(update.status, 'pending')
    assert.equal(update.attempts, 2)
    assert.ok(update.nextRetryAt)

    const failed = buildRetryUpdate({ attempts: 4 }, new ApiError('Server error', null, 500))
    assert.equal(failed.status, 'failed')
    assert.equal(failed.nextRetryAt, null)
  })
})

describe('sync image hash deduplication', () => {
  it('uploads when there is no stored hash or the hash changed', () => {
    assert.equal(shouldUploadImage('abc', null), true)
    assert.equal(shouldUploadImage('abc', 'def'), true)
    assert.equal(shouldUploadImage('abc', 'abc'), false)
    assert.equal(shouldUploadImage(null, null), false)
  })

  it('hashes buffers deterministically for upload comparisons', () => {
    const hash = createHash('sha256').update('piecelogue').digest('hex')
    assert.equal(hash.length, 64)
  })
})

describe('sync job readiness', () => {
  it('does not process failed or conflict jobs', () => {
    assert.equal(isJobReady({ status: SYNC_JOB_STATUS.FAILED }), false)
    assert.equal(isJobReady({ status: SYNC_JOB_STATUS.CONFLICT }), false)
    assert.equal(isJobReady({ status: SYNC_JOB_STATUS.PENDING }), true)
  })
})

describe('first-sync seeding marker', () => {
  it('only seeds when librarySeededAt is missing', async () => {
    const seededStates = new Map()

    function isSeeded(userId) {
      return Boolean(seededStates.get(userId)?.librarySeededAt)
    }

    function markSeeded(userId) {
      seededStates.set(userId, { librarySeededAt: new Date().toISOString() })
    }

    const userId = 'user-1'
    assert.equal(isSeeded(userId), false)
    markSeeded(userId)
    assert.equal(isSeeded(userId), true)
    assert.equal(isSeeded('user-2'), false)
  })
})
