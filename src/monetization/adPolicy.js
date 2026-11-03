export const FREE_INTERSTITIAL_POLICY = Object.freeze({
  warmupCompletedSaves: 3,
  saveInterval: 3,
  cooldownMs: 15 * 60 * 1000,
  maxPerDay: 3,
})

export function shouldShowFreeInterstitial({
  isPro = false,
  completedSaveCount = 0,
  shownToday = 0,
  lastShownAt = null,
  now = Date.now(),
  safeMoment = true,
  adAvailable = true,
} = {}) {
  if (isPro || !safeMoment || !adAvailable) return false

  const count = Number(completedSaveCount)
  if (!Number.isInteger(count) || count <= FREE_INTERSTITIAL_POLICY.warmupCompletedSaves) {
    return false
  }

  if (count % FREE_INTERSTITIAL_POLICY.saveInterval !== 0) {
    return false
  }

  if (shownToday >= FREE_INTERSTITIAL_POLICY.maxPerDay) {
    return false
  }

  if (lastShownAt != null) {
    const elapsed = now - Number(lastShownAt)
    if (!Number.isFinite(elapsed) || elapsed < FREE_INTERSTITIAL_POLICY.cooldownMs) {
      return false
    }
  }

  return true
}
