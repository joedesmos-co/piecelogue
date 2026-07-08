import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  generateSecureToken,
  hashToken,
  isExpired,
} from './tokens.js'

describe('tokens', () => {
  it('generates URL-safe tokens with sufficient entropy', () => {
    const token = generateSecureToken(32)
    assert.match(token, /^[A-Za-z0-9_-]+$/)
    assert.ok(token.length >= 40)
  })

  it('hashes tokens deterministically with SHA-256', async () => {
    const first = await hashToken('sample-token')
    const second = await hashToken('sample-token')
    assert.equal(first, second)
    assert.notEqual(first, 'sample-token')
  })

  it('detects expired timestamps', () => {
    const past = new Date(Date.now() - 1000).toISOString()
    const future = new Date(Date.now() + 60_000).toISOString()
    assert.equal(isExpired(past), true)
    assert.equal(isExpired(future), false)
  })
})
