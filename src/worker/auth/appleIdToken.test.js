import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { APPLE_ISSUER, validateAppleIdTokenClaims } from './appleIdToken.js'

describe('appleIdToken claims', () => {
  it('accepts valid Apple ID token claims', () => {
    const claims = validateAppleIdTokenClaims(
      {
        iss: APPLE_ISSUER,
        aud: 'com.piecelogue.web',
        exp: Math.floor(Date.now() / 1000) + 300,
        nonce: 'nonce-token',
        email: 'artist@example.com',
        email_verified: 'true',
      },
      {
        clientId: 'com.piecelogue.web',
        nonce: 'nonce-token',
      },
    )

    assert.equal(claims.email, 'artist@example.com')
  })

  it('rejects invalid issuer, audience, expiration, and nonce', () => {
    const base = {
      iss: APPLE_ISSUER,
      aud: 'com.piecelogue.web',
      exp: Math.floor(Date.now() / 1000) + 300,
      nonce: 'nonce-token',
      email: 'artist@example.com',
      email_verified: true,
    }

    assert.throws(
      () => validateAppleIdTokenClaims({ ...base, iss: 'https://evil.example' }, { clientId: base.aud, nonce: base.nonce }),
      /issuer/i,
    )
    assert.throws(
      () => validateAppleIdTokenClaims({ ...base, aud: 'other-client' }, { clientId: base.aud, nonce: base.nonce }),
      /audience/i,
    )
    assert.throws(
      () => validateAppleIdTokenClaims({ ...base, exp: 1 }, { clientId: base.aud, nonce: base.nonce }),
      /expired/i,
    )
    assert.throws(
      () => validateAppleIdTokenClaims({ ...base, nonce: 'other' }, { clientId: base.aud, nonce: base.nonce }),
      /nonce/i,
    )
  })

  it('requires a verified email claim', () => {
    assert.throws(
      () =>
        validateAppleIdTokenClaims(
          {
            iss: APPLE_ISSUER,
            aud: 'com.piecelogue.web',
            exp: Math.floor(Date.now() / 1000) + 300,
            email: 'artist@example.com',
            email_verified: false,
          },
          { clientId: 'com.piecelogue.web', nonce: null },
        ),
      /verified/i,
    )
  })
})
