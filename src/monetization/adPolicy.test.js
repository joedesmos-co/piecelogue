import assert from 'node:assert/strict'
import test from 'node:test'

import {
  FREE_INTERSTITIAL_POLICY,
  shouldShowFreeInterstitial,
} from './adPolicy.js'

test('never shows free interstitials to Pro users', () => {
  assert.equal(
    shouldShowFreeInterstitial({
      isPro: true,
      completedSaveCount: 6,
      shownToday: 0,
    }),
    false,
  )
})

test('protects the first three saves and only uses every third save', () => {
  assert.equal(shouldShowFreeInterstitial({ completedSaveCount: 3 }), false)
  assert.equal(shouldShowFreeInterstitial({ completedSaveCount: 4 }), false)
  assert.equal(shouldShowFreeInterstitial({ completedSaveCount: 5 }), false)
  assert.equal(shouldShowFreeInterstitial({ completedSaveCount: 6 }), true)
  assert.equal(shouldShowFreeInterstitial({ completedSaveCount: 7 }), false)
  assert.equal(shouldShowFreeInterstitial({ completedSaveCount: 9 }), true)
})

test('requires a safe moment and an available ad', () => {
  assert.equal(
    shouldShowFreeInterstitial({ completedSaveCount: 6, safeMoment: false }),
    false,
  )
  assert.equal(
    shouldShowFreeInterstitial({ completedSaveCount: 6, adAvailable: false }),
    false,
  )
})

test('enforces cooldown and daily cap', () => {
  const now = 1_000_000
  assert.equal(
    shouldShowFreeInterstitial({
      completedSaveCount: 6,
      shownToday: 0,
      lastShownAt: now - FREE_INTERSTITIAL_POLICY.cooldownMs + 1,
      now,
    }),
    false,
  )

  assert.equal(
    shouldShowFreeInterstitial({
      completedSaveCount: 6,
      shownToday: 0,
      lastShownAt: now - FREE_INTERSTITIAL_POLICY.cooldownMs,
      now,
    }),
    true,
  )

  assert.equal(
    shouldShowFreeInterstitial({
      completedSaveCount: 6,
      shownToday: FREE_INTERSTITIAL_POLICY.maxPerDay,
    }),
    false,
  )
})
