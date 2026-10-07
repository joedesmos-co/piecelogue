/**
 * Format total minutes into a human-readable string.
 * Examples: "45 min", "2 hr", "2 hr 15 min", "128 hr 40 min"
 */
export function formatTime(totalMinutes) {
  const minutes = Math.max(0, Number(totalMinutes) || 0)

  if (minutes === 0) return '0 min'

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours === 0) return `${mins} min`
  if (mins === 0) return `${hours} hr`
  return `${hours} hr ${mins} min`
}

export function calculateTotalMinutes(hours, minutes) {
  const h = Math.max(0, Number(hours) || 0)
  const m = Math.max(0, Math.min(59, Number(minutes) || 0))
  return h * 60 + m
}

/** Canonical "unknown duration" label used on cards and detail. */
export const UNKNOWN_DURATION_LABEL = 'Time unknown'

export function isDurationUnknown(artworkOrMinutes, durationUnknownFlag) {
  if (typeof artworkOrMinutes === 'object' && artworkOrMinutes !== null) {
    return Boolean(artworkOrMinutes.durationUnknown) || artworkOrMinutes.totalMinutes == null
  }
  if (typeof durationUnknownFlag === 'boolean') return durationUnknownFlag
  return false
}

/**
 * Display string for an artwork's duration:
 * - unknown -> "Time unknown"
 * - known -> formatTime(totalMinutes)
 * Pure helper for cards, detail, and stats.
 */
export function formatArtworkDuration(artwork) {
  if (!artwork) return UNKNOWN_DURATION_LABEL
  if (isDurationUnknown(artwork)) return UNKNOWN_DURATION_LABEL
  return formatTime(artwork.totalMinutes ?? 0)
}
