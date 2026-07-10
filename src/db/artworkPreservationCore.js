/**
 * Pure helpers for preserving artwork blob fields across metadata writes.
 * Exported for regression tests (Node-safe, no IndexedDB).
 */

export function preserveArtworkBlobFields(existing, updates) {
  if (!existing) {
    return updates
  }

  return {
    ...existing,
    ...updates,
    image: Object.prototype.hasOwnProperty.call(updates, 'image') ? updates.image : existing.image,
    thumbnail: Object.prototype.hasOwnProperty.call(updates, 'thumbnail')
      ? updates.thumbnail
      : existing.thumbnail,
  }
}

export function buildMetadataOnlyArtworkRecord(existing, scalarUpdates) {
  return preserveArtworkBlobFields(existing, scalarUpdates)
}

export function hasRenderableImageCandidates(artwork, coalesceBlob) {
  if (!artwork) {
    return false
  }

  return Boolean(coalesceBlob(artwork.thumbnail) || coalesceBlob(artwork.image))
}
