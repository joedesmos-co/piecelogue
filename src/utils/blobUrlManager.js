import { coalesceBlob, createObjectUrl, revokeObjectUrl } from './imageUtils'

const cache = new WeakMap()
const listeners = new Set()

function emit() {
  listeners.forEach((listener) => listener())
}

function getEntry(blob) {
  return cache.get(blob)
}

export function subscribeBlobUrls(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getBlobUrlSnapshot(blob) {
  const resolved = coalesceBlob(blob)
  if (!resolved) return null
  return getEntry(resolved)?.url ?? null
}

export function acquireBlobUrl(blob) {
  const resolved = coalesceBlob(blob)
  if (!resolved) return null

  let entry = getEntry(resolved)
  if (!entry) {
    const url = createObjectUrl(resolved)
    if (!url) return null
    entry = { url, refs: 0 }
    cache.set(resolved, entry)
  }

  entry.refs += 1
  emit()
  return entry.url
}

export function releaseBlobUrl(blob) {
  const resolved = coalesceBlob(blob)
  if (!resolved) return

  const entry = getEntry(resolved)
  if (!entry) return

  entry.refs -= 1
  if (entry.refs <= 0) {
    revokeObjectUrl(entry.url)
    cache.delete(resolved)
    emit()
  }
}
