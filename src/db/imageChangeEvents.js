/**
 * Change notification for the durable artworkImages store.
 *
 * Folder previews and gallery cards read image bytes out of IndexedDB through
 * ArtworkImage. When a background sync, cloud restore or repair writes new
 * bytes, the artwork's own metadata does not change, so a component that only
 * watches the artwork row would keep showing the old (missing) state forever.
 * Emitting a change when durable bytes are written lets those views re-read.
 */

export const ARTWORK_IMAGES_CHANGED_EVENT = 'piecelogue:artwork-images-changed'

const listeners = new Set()

export function notifyArtworkImagesChanged(artworkId = null) {
  const detail = artworkId ? { artworkId } : { all: true }
  for (const listener of listeners) {
    try {
      listener(detail)
    } catch {
      // A failing viewer must never break the write that triggered it.
    }
  }
}

/**
 * Subscribe to durable-image changes.
 *
 * @param {(detail:{artworkId?:string, all?:boolean}) => void} handler
 * @returns {() => void} unsubscribe
 */
export function onArtworkImagesChanged(handler) {
  listeners.add(handler)
  return () => {
    listeners.delete(handler)
  }
}
