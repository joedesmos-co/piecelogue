import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApiError } from './api.js'
import { formatUserError } from '../utils/userErrors.js'

describe('formatUserError', () => {
  it('maps known API error codes to friendly messages', () => {
    assert.equal(
      formatUserError(new ApiError('Sign in required.', 'unauthorized', 401)),
      'Sign-in expired. Please sign in again.',
    )
    assert.equal(
      formatUserError(new ApiError('Sign in required.', 'unauthorized', 403)),
      'Please sign in to continue.',
    )
    assert.equal(
      formatUserError(new ApiError('Service down', 'service_unavailable', 503)),
      'Cloud service is temporarily unavailable. Your changes are saved locally.',
    )
  })

  it('hides generic HTTP status messages', () => {
    assert.equal(
      formatUserError(new ApiError('Request failed (500)', null, 500)),
      'Something went wrong. Please try again.',
    )
  })

  it('passes through specific server messages when helpful', () => {
    assert.equal(
      formatUserError(new ApiError('That username is already taken.', 'username_taken', 409)),
      'That username is already taken.',
    )
  })

  it('maps network failures to friendly offline/sync messages', () => {
    assert.equal(
      formatUserError(new TypeError('Failed to fetch')),
      'Could not reach Piecelogue. Check your connection — your local library is safe.',
    )
  })
})
