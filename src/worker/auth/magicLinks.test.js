import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isWithinRequestCooldown } from './magicLinks.js'
import { nowIso } from './tokens.js'

describe('magic link abuse protection', () => {
  it('blocks rapid repeated requests within cooldown window', () => {
    const recent = nowIso()
    assert.equal(isWithinRequestCooldown(recent), true)
  })

  it('allows requests after cooldown window', () => {
    const old = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    assert.equal(isWithinRequestCooldown(old), false)
  })

  it('allows first request when no prior link exists', () => {
    assert.equal(isWithinRequestCooldown(null), false)
    assert.equal(isWithinRequestCooldown(undefined), false)
  })
})
