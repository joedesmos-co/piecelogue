import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildOAuthStateCookie,
  constantTimeEqual,
  createOAuthState,
  validateOAuthState,
} from './oauthState.js'

const developmentEnv = { ENVIRONMENT: 'development' }

function makeRequest(cookieHeader, url = 'http://localhost:8787/api/auth/google/callback') {
  return new Request(url, {
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  })
}

describe('oauthState', () => {
  it('creates URL-safe state tokens with sufficient entropy', () => {
    const state = createOAuthState()
    assert.match(state, /^[A-Za-z0-9_-]+$/)
    assert.ok(state.length >= 32)
  })

  it('validates matching state from the OAuth callback', () => {
    const state = 'oauth-state-token'
    const request = makeRequest(`piecelogue_oauth_state_dev=${encodeURIComponent(state)}`)

    assert.equal(validateOAuthState(request, developmentEnv, state), true)
  })

  it('rejects missing or mismatched callback state', () => {
    const request = makeRequest('piecelogue_oauth_state_dev=expected-state')

    assert.equal(validateOAuthState(request, developmentEnv, null), false)
    assert.equal(validateOAuthState(request, developmentEnv, 'different-state'), false)
    assert.equal(validateOAuthState(makeRequest(null), developmentEnv, 'expected-state'), false)
  })

  it('compares state values in constant time', () => {
    assert.equal(constantTimeEqual('abc', 'abc'), true)
    assert.equal(constantTimeEqual('abc', 'abd'), false)
    assert.equal(constantTimeEqual('abc', 'abcd'), false)
  })

  it('builds a short-lived HttpOnly OAuth state cookie', () => {
    const cookie = buildOAuthStateCookie('state-token', makeRequest(null), developmentEnv)

    assert.match(cookie, /^piecelogue_oauth_state_dev=state-token/)
    assert.match(cookie, /HttpOnly/)
    assert.match(cookie, /SameSite=Lax/)
    assert.match(cookie, /Max-Age=600/)
    assert.doesNotMatch(cookie, /Secure/)
  })
})
