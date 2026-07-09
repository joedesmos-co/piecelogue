import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { handleAppleStart } from '../api/appleAuth.js'

describe('appleAuth routes', () => {
  it('redirects to Apple when OAuth credentials are configured', async () => {
    const env = {
      ENVIRONMENT: 'development',
      APP_ORIGIN: 'http://localhost:8787',
      APPLE_CLIENT_ID: 'com.piecelogue.web',
      APPLE_TEAM_ID: 'TEAM123',
      APPLE_KEY_ID: 'KEY123',
      APPLE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----',
      DB: {},
    }
    const request = new Request('http://localhost:8787/api/auth/apple/start')

    const response = await handleAppleStart(request, env)

    assert.equal(response.status, 302)
    assert.match(response.headers.get('Location') || '', /^https:\/\/appleid\.apple\.com\/auth\/authorize/)
    assert.match(response.headers.get('Set-Cookie') || '', /oauth_state/)
    assert.match(response.headers.get('Set-Cookie') || '', /SameSite=None/)
  })

  it('redirects to the app when OAuth is not configured', async () => {
    const env = {
      ENVIRONMENT: 'development',
      APP_ORIGIN: 'http://localhost:8787',
      DB: {},
    }
    const request = new Request('http://localhost:8787/api/auth/apple/start')

    const response = await handleAppleStart(request, env)

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), 'http://localhost:8787/app?auth=error')
  })
})
