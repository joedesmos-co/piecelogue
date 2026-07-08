import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildGoogleAuthUrl, getAppOrigin, getGoogleRedirectUri } from './googleOAuth.js'

describe('googleOAuth', () => {
  it('builds the Google authorization URL with required params', () => {
    const url = new URL(
      buildGoogleAuthUrl({
        clientId: 'client-id.apps.googleusercontent.com',
        redirectUri: 'https://piecelogue.com/api/auth/google/callback',
        state: 'state-token',
      }),
    )

    assert.equal(url.origin, 'https://accounts.google.com')
    assert.equal(url.pathname, '/o/oauth2/v2/auth')
    assert.equal(url.searchParams.get('client_id'), 'client-id.apps.googleusercontent.com')
    assert.equal(url.searchParams.get('redirect_uri'), 'https://piecelogue.com/api/auth/google/callback')
    assert.equal(url.searchParams.get('response_type'), 'code')
    assert.equal(url.searchParams.get('state'), 'state-token')
    assert.match(url.searchParams.get('scope') || '', /email/)
  })

  it('uses APP_ORIGIN for redirect URI in production', () => {
    const env = { ENVIRONMENT: 'production', APP_ORIGIN: 'https://piecelogue.com' }
    const request = new Request('https://piecelogue.com/api/auth/google/start')

    assert.equal(getAppOrigin(env, request), 'https://piecelogue.com')
    assert.equal(getGoogleRedirectUri(env, request), 'https://piecelogue.com/api/auth/google/callback')
  })

  it('uses request origin for redirect URI in development', () => {
    const env = { ENVIRONMENT: 'development', APP_ORIGIN: 'http://localhost:8787' }
    const request = new Request('http://localhost:8788/api/auth/google/start')

    assert.equal(getGoogleRedirectUri(env, request), 'http://localhost:8788/api/auth/google/callback')
  })
})
