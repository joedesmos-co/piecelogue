import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'
import {
  isNoAnimationsPreferenceEnabled,
  setNoAnimationsPreferenceEnabled,
  shouldReduceMotion,
} from './motionPreference.js'

function makeStorage() {
  const store = new Map()
  return {
    getItem(key) { return store.has(key) ? store.get(key) : null },
    setItem(key, value) { store.set(key, String(value)) },
    removeItem(key) { store.delete(key) },
  }
}

describe('motion preference', () => {
  beforeEach(() => {
    globalThis.localStorage = makeStorage()
  })

  it('defaults to animations enabled', () => {
    assert.equal(isNoAnimationsPreferenceEnabled(), false)
  })

  it('stores and reads NO ANIMATIONS preference', () => {
    setNoAnimationsPreferenceEnabled(true)
    assert.equal(isNoAnimationsPreferenceEnabled(), true)
    setNoAnimationsPreferenceEnabled(false)
    assert.equal(isNoAnimationsPreferenceEnabled(), false)
  })

  it('shouldReduceMotion reflects the preference', () => {
    setNoAnimationsPreferenceEnabled(true)
    assert.equal(shouldReduceMotion(), true)
    setNoAnimationsPreferenceEnabled(false)
    assert.equal(shouldReduceMotion(), false)
  })

  it('handles malformed/missing storage safely', () => {
    globalThis.localStorage = {
      getItem() { throw new Error('boom') },
      setItem() { throw new Error('boom') },
      removeItem() { throw new Error('boom') },
    }
    assert.equal(isNoAnimationsPreferenceEnabled(), false)
    assert.equal(shouldReduceMotion(), false)
    // set should not throw
    setNoAnimationsPreferenceEnabled(true)
  })
})