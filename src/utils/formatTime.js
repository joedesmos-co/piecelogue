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
