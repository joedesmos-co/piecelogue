/**
 * Pure helpers for building the image-repair entry list shown to the user.
 *
 * Two independent surveys can flag the same artwork as needing a repair:
 * the local durable-image store, and cloud-image reconciliation. Both must
 * collapse to a single artwork-level entry, and neither may surface artwork
 * that no longer exists locally.
 */

/**
 * Merge repair entry groups into one entry per artwork.
 *
 * @param {...Array<object>} groups entry lists from each source
 * @returns {Array<object>} one entry per artworkId, reasons unioned
 */
export function mergeRepairEntries(...groups) {
  const byArtwork = new Map()

  for (const group of groups) {
    for (const entry of group ?? []) {
      if (!entry?.artworkId) {
        continue
      }

      const existing = byArtwork.get(entry.artworkId)
      if (existing) {
        existing.reasons = Array.from(
          new Set([...(existing.reasons ?? []), ...(entry.reasons ?? [])]),
        )
        if (!existing.title && entry.title) {
          existing.title = entry.title
        }
        continue
      }

      byArtwork.set(entry.artworkId, {
        ...entry,
        reasons: [...(entry.reasons ?? [])],
      })
    }
  }

  return Array.from(byArtwork.values())
}

/** Keep entries whose artwork still exists locally. */
export function filterRepairableEntries(entries = [], localArtworkIds = []) {
  const known = localArtworkIds instanceof Set ? localArtworkIds : new Set(localArtworkIds ?? [])
  return (entries ?? []).filter((entry) => known.has(entry.artworkId))
}
