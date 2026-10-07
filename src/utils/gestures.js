/**
 * Pure gesture decision helpers for mobile UX polish.
 * Kept DOM-free so they are unit-testable in Node.
 */

export const EDGE_SWIPE_ZONE_PX = 28
export const EDGE_SWIPE_MIN_DX = 72
export const EDGE_SWIPE_MAX_DY = 56
export const EDGE_SWIPE_MIN_VELOCITY = 0.35 // px per ms

export const ARTWORK_SWIPE_MIN_DX = 64
export const ARTWORK_SWIPE_MAX_DY = 48
export const ARTWORK_SWIPE_MIN_VELOCITY = 0.3 // px per ms

const INTERACTIVE_SELECTOR =
  'input, textarea, select, button, a, [role="dialog"], [contenteditable], .lightbox-overlay, .action-sheet-root, .modal-overlay'

export function isInteractiveTarget(target) {
  if (!target || typeof target.closest !== 'function') return false
  return Boolean(target.closest(INTERACTIVE_SELECTOR))
}

/**
 * iOS-style folder back swipe: begins near the left edge, moves right far
 * enough / fast enough, and stays mostly horizontal.
 */
export function shouldTriggerEdgeBackSwipe({
  startX,
  startY,
  endX,
  endY,
  durationMs,
  zonePx = EDGE_SWIPE_ZONE_PX,
  minDx = EDGE_SWIPE_MIN_DX,
  maxDy = EDGE_SWIPE_MAX_DY,
  minVelocity = EDGE_SWIPE_MIN_VELOCITY,
} = {}) {
  if (
    ![startX, startY, endX, endY, durationMs].every(
      (value) => typeof value === 'number' && Number.isFinite(value),
    )
  ) {
    return false
  }
  if (startX > zonePx) return false
  const dx = endX - startX
  const dy = Math.abs(endY - startY)
  if (dx < minDx) return false
  if (dy > maxDy) return false
  if (dx < Math.abs(endY - startY) * 1.4) return false
  if (durationMs <= 0) return dx >= minDx && dy <= maxDy
  return dx / durationMs >= minVelocity || dx >= minDx * 1.6
}

/**
 * Artwork detail horizontal navigation.
 * Returns 'next' | 'prev' | null.
 */
export function resolveArtworkSwipe({
  startX,
  startY,
  endX,
  endY,
  durationMs,
  minDx = ARTWORK_SWIPE_MIN_DX,
  maxDy = ARTWORK_SWIPE_MAX_DY,
  minVelocity = ARTWORK_SWIPE_MIN_VELOCITY,
} = {}) {
  if (
    ![startX, startY, endX, endY, durationMs].every(
      (value) => typeof value === 'number' && Number.isFinite(value),
    )
  ) {
    return null
  }
  const dx = endX - startX
  const dy = Math.abs(endY - startY)
  if (Math.abs(dx) < minDx) return null
  if (dy > maxDy) return null
  if (Math.abs(dx) < dy * 1.4) return null
  const velocity = durationMs > 0 ? Math.abs(dx) / durationMs : Infinity
  if (velocity < minVelocity && Math.abs(dx) < minDx * 1.6) return null
  return dx < 0 ? 'next' : 'prev'
}

/** Clamp a detail index into a collection of the given length. */
export function clampDetailIndex(index, length) {
  if (!Number.isFinite(length) || length <= 0) return -1
  if (!Number.isFinite(index)) return 0
  return Math.min(length - 1, Math.max(0, Math.floor(index)))
}

/** Neighbor id in an ordered collection, or null at the bounds. */
export function neighborArtworkId(collection, index, direction) {
  if (!Array.isArray(collection) || collection.length === 0) return null
  const current = clampDetailIndex(index, collection.length)
  if (current < 0) return null
  const next = direction === 'next' ? current + 1 : current - 1
  if (next < 0 || next >= collection.length) return null
  return collection[next]?.id ?? null
}
