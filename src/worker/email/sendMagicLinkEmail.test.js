import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isDevMode } from '../email/sendMagicLinkEmail.js'

describe('sendMagicLinkEmail dev mode', () => {
  it('detects local development mode flag', () => {
    assert.equal(isDevMode({ AUTH_DEV_MODE: 'true' }), true)
    assert.equal(isDevMode({ AUTH_DEV_MODE: ' TRUE ' }), true)
    assert.equal(isDevMode({ AUTH_DEV_MODE: '1' }), true)
    assert.equal(isDevMode({ ENVIRONMENT: 'development' }), true)
    assert.equal(isDevMode({ AUTH_DEV_MODE: 'false' }), false)
    assert.equal(isDevMode({}), false)
  })
})
