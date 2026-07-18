import assert from 'node:assert/strict'
import { afterEach, describe, it, mock } from 'node:test'
import { ApiError, apiFetch, requireLiveSession } from './api.js'
import {
  clearApiRequestDiagnostics,
  getDisplayMode,
  getLastApiRequestDiagnostic,
  isStandaloneDisplayMode,
  onUnauthorized,
} from './apiDiagnostics.js'
import { formatCloudDeleteError } from './cloudDeleteErrors.js'

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('apiFetch credentials and 401 handling', () => {
  afterEach(() => {
    clearApiRequestDiagnostics()
    mock.restoreAll()
  })

  it('forces credentials include even when caller passes omit', async () => {
    let seenCredentials = null
    mock.method(globalThis, 'fetch', async (_url, options = {}) => {
      seenCredentials = options.credentials
      return jsonResponse({ ok: true })
    })

    await apiFetch('/api/cloud/status', { credentials: 'omit' })
    assert.equal(seenCredentials, 'include')
  })

  it('records safe diagnostics without secrets', async () => {
    mock.method(globalThis, 'fetch', async () =>
      jsonResponse({ error: { code: 'rate_limit', message: 'Slow down' } }, 429),
    )

    await assert.rejects(() => apiFetch('/api/account/cloud-data', { method: 'POST' }), ApiError)

    const diagnostic = getLastApiRequestDiagnostic()
    assert.equal(diagnostic.path, '/api/account/cloud-data')
    assert.equal(diagnostic.method, 'POST')
    assert.equal(diagnostic.status, 429)
    assert.equal(diagnostic.errorCode, 'rate_limit')
    assert.equal(diagnostic.credentials, 'include')
    assert.equal(diagnostic.wasJson, true)
    assert.equal('cookie' in diagnostic, false)
    assert.equal('token' in diagnostic, false)
  })

  it('notifies unauthorized listeners on 401', async () => {
    let notified = null
    const stop = onUnauthorized((detail) => {
      notified = detail
    })

    mock.method(globalThis, 'fetch', async () =>
      jsonResponse({ error: { code: 'unauthorized', message: 'Sign in' } }, 401),
    )

    await assert.rejects(() => apiFetch('/api/cloud/library'), ApiError)
    assert.equal(notified?.status, 401)
    assert.equal(notified?.path, '/api/cloud/library')
    stop()
  })

  it('requireLiveSession throws when authenticated is false', async () => {
    await assert.rejects(
      () => requireLiveSession(async () => ({ authenticated: false, user: null })),
      (error) =>
        error instanceof ApiError &&
        error.status === 401 &&
        error.message === 'Your session expired. Sign in again.',
    )
  })
})

describe('standalone display mode detection', () => {
  it('does not assume Safari session from display mode helpers', () => {
    // In Node there is no window — helpers must stay conservative.
    assert.equal(getDisplayMode(), 'unknown')
    assert.equal(isStandaloneDisplayMode(), false)
  })
})

describe('formatCloudDeleteError', () => {
  it('surfaces 401/429/500 distinctly', () => {
    assert.equal(
      formatCloudDeleteError(new ApiError('x', 'unauthorized', 401)),
      'Your session expired. Sign in again.',
    )
    assert.equal(
      formatCloudDeleteError(new ApiError('x', 'forbidden', 403)),
      'You do not have permission to delete cloud data.',
    )
    assert.equal(
      formatCloudDeleteError(new ApiError('x', 'rate_limit', 429)),
      'Too many requests. Please wait a moment and try again.',
    )
    assert.equal(
      formatCloudDeleteError(new ApiError('x', 'service_unavailable', 500)),
      'Server error while deleting cloud data. Please try again.',
    )
  })

  it('maps network failures without the generic fallback', () => {
    assert.match(formatCloudDeleteError(new TypeError('Failed to fetch')), /Could not reach/)
  })
})
