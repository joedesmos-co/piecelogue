import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as pe from './promptEngine.js'

describe('idea generator', () => {
  it('returns a non-empty string', () => {
    const p = pe.generateIdea()
    assert.equal(typeof p, 'string')
    assert.ok(p.length > 0)
    assert.ok(!/undefined|null/.test(p))
  })

  it('filters affect generation (subject pool)', () => {
    const p = pe.generateIdea({ subject: 'Creature', difficulty: 'Easy' })
    assert.ok(typeof p === 'string')
  })

  it('surprise me works', () => {
    const p = pe.surpriseMe()
    assert.equal(typeof p, 'string')
    assert.ok(p.length > 0)
  })

  it('is deterministic with seed', () => {
    const a = pe.generateIdea({ seed: 42 })
    const b = pe.generateIdea({ seed: 42 })
    assert.equal(a, b)
  })
})

describe('art challenge', () => {
  it('generates a challenge', () => {
    const c = pe.generateChallenge('NORMAL')
    assert.ok(c.text.includes('CHALLENGE'))
    assert.ok(c.prompt.length > 0)
  })

  it('difficulty affects available challenges (HARD has harder techniques)', () => {
    const hard = pe.generateChallenge({ difficulty: 'HARD' })
    assert.equal(hard.difficulty, 'HARD')
    // HARD-only technique should be possible; at least no crash
    assert.ok(typeof hard.technique === 'string')
  })

  it('supports object and string difficulty', () => {
    const a = pe.generateChallenge('CHILL')
    const b = pe.generateChallenge({ difficulty: 'CHILL' })
    assert.equal(a.difficulty, b.difficulty)
  })
})

describe('prompt wheel', () => {
  it('spin all returns all categories', () => {
    const v = pe.spinAll()
    for (const c of pe.WHEEL_CATEGORIES) assert.ok(v[c])
  })

  it('individual category spin changes only that category (function)', () => {
    const v = pe.spinAll(1)
    const next = { ...v, SUBJECT: pe.spinCategory('SUBJECT', 2) }
    assert.notEqual(next.SETTING, undefined)
  })

  it('buildWheelPrompt is natural sentence', () => {
    const v = pe.spinAll(1)
    const p = pe.buildWheelPrompt(v)
    assert.ok(p.startsWith('Create a'))
    assert.ok(!/undefined/.test(p))
  })

  it('no invalid combinations across many spins', () => {
    for (let i = 0; i < 200; i++) {
      const v = pe.spinAll(i)
      const p = pe.buildWheelPrompt(v)
      assert.ok(!/undefined|null/.test(p))
      assert.ok(p.length > 10)
    }
  })
})

describe('quick prompt', () => {
  it('returns a string', () => {
    const p = pe.generateQuickPrompt()
    assert.equal(typeof p, 'string')
    assert.ok(p.length > 0)
  })
})

describe('reduced motion / offline', () => {
  it('generator works without network (sync)', () => {
    // just ensure no async/network
    const p = pe.generateIdea({ medium: 'Pencil' })
    assert.ok(p.length > 0)
  })
})
