import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { handleGoogleStart } from '../api/googleAuth.js'

describe('googleAuth routes', () => {
  it('redirects to Google when OAuth credentials are configured', async () => {
    const env = {
      ENVIRONMENT: 'development',
      APP_ORIGIN: 'http://localhost:8787',
      GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      DB: {},
    }
    const request = new Request('http://localhost:8787/api/auth/google/start')

    const response = await handleGoogleStart(request, env)

    assert.equal(response.status, 302)
    assert.match(response.headers.get('Location') || '', /^https:\/\/accounts\.google\.com\//)
    assert.match(response.headers.get('Set-Cookie') || '', /oauth_state/)
  })

  it('redirects to the app when OAuth is not configured', async () => {
    const env = {
      ENVIRONMENT: 'development',
      APP_ORIGIN: 'http://localhost:8787',
      DB: {},
    }
    const request = new Request('http://localhost:8787/api/auth/google/start')

    const response = await handleGoogleStart(request, env)

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), 'http://localhost:8787/app?auth=error')
  })
})
