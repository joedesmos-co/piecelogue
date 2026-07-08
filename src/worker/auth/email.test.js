import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { normalizeEmail, isValidEmail } from './email.js'

describe('email normalization', () => {
  it('trims and lowercases email', () => {
    assert.equal(normalizeEmail('  Artist@Example.COM '), 'artist@example.com')
  })

  it('validates common email shapes', () => {
    assert.equal(isValidEmail('artist@example.com'), true)
    assert.equal(isValidEmail('bad-email'), false)
    assert.equal(isValidEmail(''), false)
  })
})
