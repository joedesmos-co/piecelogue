import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApiError, requireLiveSession } from './api.js'
import { classifySyncError } from '../sync/retry.js'

describe('cloud session / sync stop on unauthenticated', () => {
  it('requireLiveSession stops sync when me is unauthenticated', async () => {
    await assert.rejects(
      () => requireLiveSession(async () => ({ authenticated: false, user: null })),
      (error) =>
        error instanceof ApiError &&
        error.status === 401 &&
        error.code === 'unauthorized',
    )
  })

  it('requireLiveSession stops restore when me is unauthenticated', async () => {
    await assert.rejects(
      () => requireLiveSession(async () => ({ authenticated: false, user: null })),
      (error) => error instanceof ApiError && error.status === 401,
    )
  })

  it('treats 401/403 sync errors as permanent (no endless retries)', () => {
    assert.deepEqual(classifySyncError(new ApiError('No', 'unauthorized', 401)), {
      retryable: false,
      permanent: true,
    })
    assert.deepEqual(classifySyncError(new ApiError('No', 'forbidden', 403)), {
      retryable: false,
      permanent: true,
    })
  })
})
