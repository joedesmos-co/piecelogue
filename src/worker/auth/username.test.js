import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  formatUsernameHandle,
  isValidUsername,
  normalizeUsername,
  validateUsername,
} from './username.js'

describe('username validation', () => {
  it('normalizes usernames to lowercase without @ prefix', () => {
    assert.equal(normalizeUsername('  Ryland '), 'ryland')
    assert.equal(normalizeUsername('@Ryland'), 'ryland')
  })

  it('accepts valid usernames', () => {
    assert.equal(isValidUsername('ryland'), true)
    assert.equal(isValidUsername('art_42'), true)
    assert.equal(validateUsername('ryland').ok, true)
  })

  it('rejects invalid characters and lengths', () => {
    assert.equal(isValidUsername('ab'), false)
    assert.equal(isValidUsername('a'.repeat(25)), false)
    assert.equal(isValidUsername('ry land'), false)
    assert.equal(isValidUsername('ry-land'), false)

    const result = validateUsername('ab')
    assert.equal(result.ok, false)
    assert.equal(result.code, 'invalid_username')
  })

  it('formats usernames as handles', () => {
    assert.equal(formatUsernameHandle('ryland'), '@ryland')
    assert.equal(formatUsernameHandle(''), null)
  })
})
