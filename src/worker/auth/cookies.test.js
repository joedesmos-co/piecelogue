import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildClearSessionCookie,
  buildSessionCookie,
  getSessionCookieName,
  getSessionTokenFromRequest,
} from './cookies.js'

function makeRequest(cookieHeader, url = 'https://piecelogue.com/api/auth/me') {
  return new Request(url, {
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  })
}

const productionEnv = { ENVIRONMENT: 'production' }
const developmentEnv = { ENVIRONMENT: 'development' }

describe('cookies', () => {
  it('uses production cookie name in production', () => {
    assert.equal(getSessionCookieName(productionEnv), '__Host-piecelogue_session')
  })

  it('uses dev cookie name outside production', () => {
    assert.equal(getSessionCookieName(developmentEnv), 'piecelogue_session_dev')
  })

  it('reads the production session cookie token', () => {
    const request = makeRequest('__Host-piecelogue_session=abc123; other=value')
    assert.equal(getSessionTokenFromRequest(request, productionEnv), 'abc123')
  })

  it('reads the dev session cookie token', () => {
    const request = makeRequest('piecelogue_session_dev=abc123; other=value', 'http://localhost:8787/api/auth/me')
    assert.equal(getSessionTokenFromRequest(request, developmentEnv), 'abc123')
  })

  it('returns null when cookie is missing', () => {
    const request = makeRequest(null)
    assert.equal(getSessionTokenFromRequest(request, productionEnv), null)
  })

  it('builds secure session cookies in production', () => {
    const request = makeRequest(null)
    const cookie = buildSessionCookie('token-value', request, productionEnv)
    assert.match(cookie, /^__Host-piecelogue_session=token-value/)
    assert.match(cookie, /HttpOnly/)
    assert.match(cookie, /Secure/)
    assert.match(cookie, /SameSite=Lax/)
    assert.match(cookie, /Path=\//)
    assert.match(cookie, /Max-Age=2592000/)
    assert.doesNotMatch(cookie, /Domain=/)
  })

  it('builds non-secure dev session cookies on localhost', () => {
    const request = makeRequest(null, 'http://localhost:8787/api/auth/verify')
    const cookie = buildSessionCookie('token-value', request, developmentEnv)
    assert.match(cookie, /^piecelogue_session_dev=token-value/)
    assert.match(cookie, /HttpOnly/)
    assert.match(cookie, /SameSite=Lax/)
    assert.match(cookie, /Path=\//)
    assert.doesNotMatch(cookie, /Secure/)
    assert.doesNotMatch(cookie, /Domain=/)
  })

  it('clears the session cookie idempotently', () => {
    const request = makeRequest(null, 'https://piecelogue.com/api/auth/logout')
    const cookie = buildClearSessionCookie(request, productionEnv)
    assert.match(cookie, /^__Host-piecelogue_session=/)
    assert.match(cookie, /Max-Age=0/)
  })
})
