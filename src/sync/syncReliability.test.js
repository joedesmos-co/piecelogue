import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
import { ApiError } from '../utils/api.js'
import { fetchWithTimeout } from '../utils/fetchWithTimeout.js'
import {
  ImageUploadError,
  isHeicMimeType,
  isSupportedUploadMime,
  prepareBlobForUpload,
} from './imageUpload.js'
import {
  clearRetryScheduler,
  getStuckProcessingJobsToRecover,
  recoverStuckProcessingJobs,
  scheduleRetryWake,
  STUCK_PROCESSING_THRESHOLD_MS,
} from './retryScheduler.js'
import {
  cancelForceSync,
  isForceSyncActive,
  releaseArtworkUpload,
  releaseForceSyncLock,
  shouldPauseBackgroundProcessor,
  tryAcquireArtworkUpload,
  tryAcquireForceSyncLock,
} from './syncLock.js'
import { buildRetryUpdate, classifySyncError } from './retry.js'
import { SYNC_JOB_STATUS } from './constants.js'
import { isJobReady } from './queueLogic.js'

describe('sync lock', () => {
  it('force sync pauses background sync and releases after failure', () => {
    const lock = tryAcquireForceSyncLock('user-1')
    assert.ok(lock)
    assert.equal(isForceSyncActive(), true)
    assert.equal(shouldPauseBackgroundProcessor(), true)
    assert.equal(tryAcquireForceSyncLock('user-1'), null)

    releaseForceSyncLock()

    assert.equal(isForceSyncActive(), false)
    assert.equal(shouldPauseBackgroundProcessor(), false)
  })

  it('prevents duplicate concurrent uploads for the same artwork', () => {
    assert.equal(tryAcquireArtworkUpload('art-1', 'background'), true)
    assert.equal(tryAcquireArtworkUpload('art-1', 'force'), false)

    releaseArtworkUpload('art-1')
    assert.equal(tryAcquireArtworkUpload('art-1', 'force'), true)
    releaseArtworkUpload('art-1')
  })

  it('cancels force sync through the abort controller', () => {
    const lock = tryAcquireForceSyncLock('user-1')
    assert.equal(lock.signal.aborted, false)
    cancelForceSync()
    assert.equal(lock.signal.aborted, true)
    releaseForceSyncLock()
  })
})

describe('fetch timeouts', () => {
  it('turns hung requests into retryable timeout errors', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock.fn(async (_url, options) => {
      return new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          const abortError = new Error('Aborted')
          abortError.name = 'AbortError'
          reject(abortError)
        })
      })
    })

    try {
      await assert.rejects(
        () => fetchWithTimeout('/api/cloud/artworks/test/original', {}, 20),
        (error) => error instanceof ApiError && error.code === 'timeout',
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

describe('image upload validation', () => {
  it('rejects zero-byte blobs before upload', async () => {
    const blob = new Blob([], { type: 'image/jpeg' })

    await assert.rejects(
      () => prepareBlobForUpload(blob, { stage: 'original', artworkTitle: 'Mario and Yoshi' }),
      (error) => error instanceof ImageUploadError && error.code === 'empty_blob',
    )
  })

  it('reads Safari zero-size blobs when bytes exist', async () => {
    const blob = new Blob(['image-bytes'], { type: 'image/jpeg' })
    Object.defineProperty(blob, 'size', { value: 0 })

    const prepared = await prepareBlobForUpload(blob, { stage: 'thumbnail' })
    assert.equal(prepared.byteSize, 11)
    assert.equal(prepared.mimeType, 'image/jpeg')
  })

  it('rejects HEIC and other unsupported MIME types', async () => {
    const heic = new Blob(['heic'], { type: 'image/heic' })

    await assert.rejects(
      () => prepareBlobForUpload(heic, { stage: 'original' }),
      (error) => error instanceof ImageUploadError && error.code === 'unsupported_format',
    )

    assert.equal(isHeicMimeType('image/heif'), true)
    assert.equal(isSupportedUploadMime('image/png'), true)
    assert.equal(isSupportedUploadMime('image/heic'), false)
  })

  it('handles original success with thumbnail failure as a permanent image error', () => {
    const error = new ImageUploadError('Image file is empty.', 'empty_blob', {
      stage: 'thumbnail',
      artworkTitle: 'Mario and Yoshi',
      mimeType: 'image/jpeg',
      byteSize: 0,
      permanent: true,
    })

    const update = buildRetryUpdate({ attempts: 0 }, error)
    assert.equal(update.status, 'failed')
    assert.match(update.lastError, /Mario and Yoshi/)
    assert.match(update.lastError, /thumbnail/)
  })
})

describe('stuck processing job recovery', () => {
  it('resets processing jobs that exceed the safe threshold', async () => {
    const updates = []
    const jobs = [
      {
        id: 1,
        status: SYNC_JOB_STATUS.PROCESSING,
        processingStartedAt: new Date(Date.now() - STUCK_PROCESSING_THRESHOLD_MS - 1000).toISOString(),
      },
      {
        id: 2,
        status: SYNC_JOB_STATUS.PROCESSING,
        processingStartedAt: new Date().toISOString(),
      },
    ]

    const stuckJobs = getStuckProcessingJobsToRecover(jobs, STUCK_PROCESSING_THRESHOLD_MS, Date.now())
    assert.equal(stuckJobs.length, 1)
    assert.equal(stuckJobs[0].id, 1)

    const recovered = await recoverStuckProcessingJobs(
      'user-1',
      STUCK_PROCESSING_THRESHOLD_MS,
      Date.now(),
      {
        getJobs: async () => jobs,
        updateJob: async (jobId, update) => {
          updates.push({ jobId, update })
        },
      },
    )

    assert.equal(recovered, 1)
    assert.equal(updates.length, 1)
    assert.equal(updates[0].update.status, SYNC_JOB_STATUS.PENDING)
  })

  it('does not treat processing jobs as ready work', () => {
    assert.equal(
      isJobReady({
        status: SYNC_JOB_STATUS.PROCESSING,
        nextRetryAt: null,
      }),
      false,
    )
  })
})

describe('nextRetryAt timer wakes processor', () => {
  it('schedules a wake when retry time is in the future', () => {
    let woke = false
    const wakeFn = () => {
      woke = true
    }

    scheduleRetryWake(
      [
        {
          status: SYNC_JOB_STATUS.PENDING,
          nextRetryAt: new Date(Date.now() + 40).toISOString(),
        },
      ],
      wakeFn,
    )

    return new Promise((resolve) => {
      setTimeout(() => {
        assert.equal(woke, true)
        clearRetryScheduler()
        resolve()
      }, 120)
    })
  })
})

describe('retry classification', () => {
  it('treats upload timeouts as retryable', () => {
    const classification = classifySyncError(new ApiError('Timed out', 'timeout', 408))
    assert.equal(classification.retryable, true)
    assert.equal(classification.permanent, false)
  })
})
