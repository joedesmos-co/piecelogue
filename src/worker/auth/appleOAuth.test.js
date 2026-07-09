import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildAppleAuthUrl,
  getAppleRedirectUri,
  isAppleOAuthConfigured,
  parseAppleUserField,
} from './appleOAuth.js'

describe('appleOAuth', () => {
  it('detects configured Apple OAuth credentials', () => {
    assert.equal(
      isAppleOAuthConfigured({
        APPLE_CLIENT_ID: 'com.piecelogue.web',
        APPLE_TEAM_ID: 'TEAM123',
        APPLE_KEY_ID: 'KEY123',
        APPLE_PRIVATE_KEY: 'private-key',
      }),
      true,
    )
    assert.equal(isAppleOAuthConfigured({ APPLE_CLIENT_ID: 'com.piecelogue.web' }), false)
  })

  it('builds the Apple authorization URL with required params', () => {
    const url = new URL(
      buildAppleAuthUrl({
        clientId: 'com.piecelogue.web',
        redirectUri: 'https://piecelogue.com/api/auth/apple/callback',
        state: 'state-token',
        nonce: 'nonce-token',
      }),
    )

    assert.equal(url.origin, 'https://appleid.apple.com')
    assert.equal(url.pathname, '/auth/authorize')
    assert.equal(url.searchParams.get('client_id'), 'com.piecelogue.web')
    assert.equal(url.searchParams.get('redirect_uri'), 'https://piecelogue.com/api/auth/apple/callback')
    assert.equal(url.searchParams.get('response_type'), 'code')
    assert.equal(url.searchParams.get('response_mode'), 'form_post')
    assert.equal(url.searchParams.get('state'), 'state-token')
    assert.equal(url.searchParams.get('nonce'), 'nonce-token')
    assert.match(url.searchParams.get('scope') || '', /email/)
  })

  it('uses APP_ORIGIN for redirect URI in production', () => {
    const env = { ENVIRONMENT: 'production', APP_ORIGIN: 'https://piecelogue.com' }
    const request = new Request('https://piecelogue.com/api/auth/apple/start')

    assert.equal(getAppleRedirectUri(env, request), 'https://piecelogue.com/api/auth/apple/callback')
  })

  it('parses Apple user display names on first authorization', () => {
    const parsed = parseAppleUserField(
      JSON.stringify({ name: { firstName: 'Ada', lastName: 'Lovelace' } }),
    )

    assert.equal(parsed.displayName, 'Ada Lovelace')
  })
})
