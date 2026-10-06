/**
 * Tiny decoupling channel between SyncProvider and ArtworkProvider.
 *
 * SyncProvider renders above ArtworkProvider in the tree, so it cannot consume
 * the artworks context. When an automatic pull changes local data it emits this
 * event, and ArtworkProvider listens and re-reads from Dexie.
 *
 * This keeps the provider order stable and avoids a circular dependency
 * between the sync layer and the artwork context.
 */

export const CLOUD_DATA_CHANGED_EVENT = 'piecelogue:cloud-data-changed'

export function notifyCloudDataChanged(detail = {}) {
  if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') {
    return
  }
  window.dispatchEvent(new CustomEvent(CLOUD_DATA_CHANGED_EVENT, { detail }))
}

export function onCloudDataChanged(handler) {
  if (typeof window === 'undefined') {
    return () => {}
  }
  const listener = (event) => handler(event?.detail)
  window.addEventListener(CLOUD_DATA_CHANGED_EVENT, listener)
  return () => window.removeEventListener(CLOUD_DATA_CHANGED_EVENT, listener)
}