import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  clampDetailIndex,
  isInteractiveTarget,
  neighborArtworkId,
  resolveArtworkSwipe,
  shouldTriggerEdgeBackSwipe,
} from './gestures.js'

describe('folder edge swipe back', () => {
  it('triggers on a right swipe from the left edge', () => {
    assert.equal(
      shouldTriggerEdgeBackSwipe({
        startX: 8,
        startY: 400,
        endX: 120,
        endY: 405,
        durationMs: 220,
      }),
      true,
    )
  })

  it('ignores swipes starting away from the edge', () => {
    assert.equal(
      shouldTriggerEdgeBackSwipe({
        startX: 120,
        startY: 400,
        endX: 260,
        endY: 405,
        durationMs: 200,
      }),
      false,
    )
  })

  it('cancels on short distance below the threshold', () => {
    assert.equal(
      shouldTriggerEdgeBackSwipe({
        startX: 8,
        startY: 400,
        endX: 40,
        endY: 402,
        durationMs: 300,
      }),
      false,
    )
  })

  it('cancels when the gesture is mostly vertical', () => {
    assert.equal(
      shouldTriggerEdgeBackSwipe({
        startX: 8,
        startY: 400,
        endX: 120,
        endY: 520,
        durationMs: 220,
      }),
      false,
    )
  })
})

describe('artwork swipe navigation', () => {
  it('swipe left goes to the next artwork', () => {
    assert.equal(
      resolveArtworkSwipe({
        startX: 300,
        startY: 400,
        endX: 180,
        endY: 405,
        durationMs: 200,
      }),
      'next',
    )
  })

  it('swipe right goes to the previous artwork', () => {
    assert.equal(
      resolveArtworkSwipe({
        startX: 120,
        startY: 400,
        endX: 240,
        endY: 398,
        durationMs: 200,
      }),
      'prev',
    )
  })

  it('cancels below the distance threshold', () => {
    assert.equal(
      resolveArtworkSwipe({
        startX: 200,
        startY: 400,
        endX: 170,
        endY: 402,
        durationMs: 200,
      }),
      null,
    )
  })

  it('ignores vertical scrolling', () => {
    assert.equal(
      resolveArtworkSwipe({
        startX: 200,
        startY: 200,
        endX: 205,
        endY: 340,
        durationMs: 250,
      }),
      null,
    )
  })

  it('never navigates from interactive targets', () => {
    const button = { closest: (selector) => (selector.includes('button') ? {} : null) }
    const backdrop = { closest: () => null }
    assert.equal(isInteractiveTarget(button), true)
    assert.equal(isInteractiveTarget(backdrop), false)
    assert.equal(isInteractiveTarget(null), false)
  })
})

describe('detail collection bounds', () => {
  const collection = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('steps within the same collection only', () => {
    assert.equal(neighborArtworkId(collection, 1, 'next'), 'c')
    assert.equal(neighborArtworkId(collection, 1, 'prev'), 'a')
  })

  it('stops at the collection bounds', () => {
    assert.equal(neighborArtworkId(collection, 0, 'prev'), null)
    assert.equal(neighborArtworkId(collection, 2, 'next'), null)
  })

  it('clamps out-of-range indexes', () => {
    assert.equal(clampDetailIndex(99, 3), 2)
    assert.equal(clampDetailIndex(-4, 3), 0)
    assert.equal(clampDetailIndex(0, 0), -1)
  })
})
