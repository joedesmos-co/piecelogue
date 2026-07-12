let forceSyncLock = null
const artworkUploadsInFlight = new Map()

export function tryAcquireForceSyncLock(userId) {
  if (forceSyncLock) {
    return null
  }

  const abortController = new AbortController()
  forceSyncLock = { userId, abortController }
  return abortController
}

export function releaseForceSyncLock() {
  forceSyncLock = null
}

export function isForceSyncActive() {
  return forceSyncLock !== null
}

export function getForceSyncAbortSignal() {
  return forceSyncLock?.abortController?.signal ?? null
}

export function cancelForceSync() {
  forceSyncLock?.abortController?.abort()
}

export function shouldPauseBackgroundProcessor() {
  return isForceSyncActive()
}

export function tryAcquireArtworkUpload(artworkId, source) {
  if (!artworkId || artworkUploadsInFlight.has(artworkId)) {
    return false
  }

  artworkUploadsInFlight.set(artworkId, source)
  return true
}

export function releaseArtworkUpload(artworkId) {
  if (!artworkId) {
    return
  }
  artworkUploadsInFlight.delete(artworkId)
}

export function releaseAllArtworkUploads() {
  artworkUploadsInFlight.clear()
}
