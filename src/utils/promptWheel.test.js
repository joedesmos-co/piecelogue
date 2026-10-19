import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as pw from './promptWheel.js'
import * as pe from './promptEngine.js'

describe('prompt wheel math', () => {
  it('segment angle divides 360', () => {
    assert.equal(pw.getWheelSegmentAngle(4), 90)
    assert.equal(pw.getWheelSegmentAngle(12), 30)
  })

  it('selected index finds value', () => {
    const opts = ['a', 'b', 'c']
    assert.equal(pw.getWheelSelectedIndex(opts, 'b'), 1)
    assert.equal(pw.getWheelSelectedIndex(opts, 'z'), 0)
  })

  it('first option lands correctly', () => {
    const rot = pw.getWheelTargetRotation(0, 4, 0, 0)
    // segment center 45deg -> target 315deg
    assert.equal(rot, 315)
  })

  it('middle option lands correctly', () => {
    const rot = pw.getWheelTargetRotation(0, 4, 1, 0)
    // center 135 -> target 225
    assert.equal(rot, 225)
  })

  it('last option lands correctly', () => {
    const rot = pw.getWheelTargetRotation(0, 4, 3, 0)
    // center 315 -> target 45
    assert.equal(rot, 45)
  })

  it('displayed result matches selected slice (rotation round-trips)', () => {
    const opts = ['x', 'y', 'z', 'w']
    for (let i = 0; i < opts.length; i++) {
      const final = pw.getWheelTargetRotation(0, opts.length, i, 2)
      // final mod 360 should equal target for index i
      const center = pw.getWheelSegmentCenter(opts.length, i)
      const target = (360 - (center % 360) + 360) % 360
      assert.equal(((final % 360) + 360) % 360, target)
    }
  })

  it('adds full turns for motion', () => {
    const noTurn = pw.getWheelTargetRotation(0, 4, 0, 0)
    const withTurns = pw.getWheelTargetRotation(0, 4, 0, 3)
    assert.equal(withTurns - noTurn, 360 * 3)
  })

  it('short labels truncate', () => {
    assert.equal(pw.shortWheelLabel('Abandoned Mall', 10), 'Abandoned…')
    assert.equal(pw.shortWheelLabel('Robot', 14), 'Robot')
  })

  it('isWheelMotionDisabled combines flags', () => {
    assert.equal(pw.isWheelMotionDisabled(true, false), true)
    assert.equal(pw.isWheelMotionDisabled(false, true), true)
    assert.equal(pw.isWheelMotionDisabled(false, false), false)
  })
})

describe('prompt wheel sequence', () => {
  const cats = ['SUBJECT', 'MOOD', 'SETTING', 'CONSTRAINT']
  function makeSpin(values) {
    return (cat) => values[cat].shift()
  }

  it('spin all resolves all four categories in order', async () => {
    const values = {
      SUBJECT: ['Robot'],
      MOOD: ['Lonely'],
      SETTING: ['Abandoned Mall'],
      CONSTRAINT: ['Only 3 Colors'],
    }
    const order = []
    const result = await pw.runWheelSpinAllSequence({
      categories: cats,
      spinCategoryFn: makeSpin(values),
      onStep: async ({ category }) => { if (category) order.push(category) },
    })
    assert.deepEqual(order, cats)
    assert.equal(result.values.SUBJECT, 'Robot')
    assert.equal(result.values.MOOD, 'Lonely')
    assert.equal(result.values.SETTING, 'Abandoned Mall')
    assert.equal(result.values.CONSTRAINT, 'Only 3 Colors')
    assert.equal(result.skipped, false)
  })

  it('skip during first category finishes immediately with four results', async () => {
    const values = {
      SUBJECT: ['Robot'],
      MOOD: ['Lonely'],
      SETTING: ['Abandoned Mall'],
      CONSTRAINT: ['Only 3 Colors'],
    }
    let skip = false
    const result = await pw.runWheelSpinAllSequence({
      categories: cats,
      spinCategoryFn: makeSpin(values),
      onStep: async () => { skip = true },
      isSkipRequested: () => skip,
    })
    assert.equal(result.skipped, true)
    assert.ok(result.values.SUBJECT)
    assert.ok(result.values.MOOD)
    assert.ok(result.values.SETTING)
    assert.ok(result.values.CONSTRAINT)
  })

  it('skip during middle sequence resolves remaining', async () => {
    const values = {
      SUBJECT: ['Robot'],
      MOOD: ['Lonely'],
      SETTING: ['Abandoned Mall'],
      CONSTRAINT: ['Only 3 Colors'],
    }
    let stepCount = 0
    const result = await pw.runWheelSpinAllSequence({
      categories: cats,
      spinCategoryFn: makeSpin(values),
      onStep: async () => { stepCount += 1 },
      isSkipRequested: () => stepCount >= 2,
    })
    assert.equal(result.skipped, true)
    assert.ok(result.values.CONSTRAINT)
  })

  it('skip during final category resolves', async () => {
    const values = {
      SUBJECT: ['Robot'],
      MOOD: ['Lonely'],
      SETTING: ['Abandoned Mall'],
      CONSTRAINT: ['Only 3 Colors'],
    }
    let stepCount = 0
    const result = await pw.runWheelSpinAllSequence({
      categories: cats,
      spinCategoryFn: makeSpin(values),
      onStep: async () => { stepCount += 1 },
      isSkipRequested: () => stepCount >= 4,
    })
    assert.equal(typeof result.values.CONSTRAINT, 'string')
    assert.ok(result.values.CONSTRAINT.length > 0)
  })

  it('individual respin changes only one category', () => {
    const base = { SUBJECT: 'Robot', MOOD: 'Lonely', SETTING: 'Mall', CONSTRAINT: '3 Colors' }
    const next = pw.applyWheelRespin(base, 'SETTING', () => 'Rooftop')
    assert.equal(next.SUBJECT, base.SUBJECT)
    assert.equal(next.MOOD, base.MOOD)
    assert.equal(next.SETTING, 'Rooftop')
    assert.equal(next.CONSTRAINT, base.CONSTRAINT)
  })

  it('final prompt reflects selections', () => {
    const vals = { SUBJECT: 'Robot', MOOD: 'Lonely', SETTING: 'on a rainy rooftop', CONSTRAINT: 'with continuous line' }
    const p = pe.buildWheelPrompt(vals)
    assert.ok(p.includes('Robot'))
  })
})
