import { normalizeArtworkImage } from './imageNormalize.js'

const THUMBNAIL_MAX_SIZE = 400
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export function isValidImageFile(file) {
  return file && ACCEPTED_TYPES.includes(file.type)
}

export function isValidImageBlob(value) {
  if (!value || typeof value !== 'object') return false

  const isBlobLike =
    value instanceof Blob ||
    value instanceof File ||
    Object.prototype.toString.call(value) === '[object Blob]'

  if (!isBlobLike) return false

  const size = typeof value.size === 'number' ? value.size : 0
  // iOS Safari may report size 0 for valid IndexedDB blobs until they are read.
  if (size > 0) return true

  return isBlobLike
}

/**
 * Preserve Dexie/IndexedDB blob values without cloning or JSON serialization.
 */
export function coalesceBlob(value) {
  if (isValidImageBlob(value)) return value

  if (value instanceof ArrayBuffer && value.byteLength > 0) {
    return new Blob([value], { type: 'image/jpeg' })
  }

  if (ArrayBuffer.isView(value) && value.byteLength > 0) {
    return new Blob([value], { type: 'image/jpeg' })
  }

  return null
}

export function coalesceArtworkBlobs(artwork) {
  if (!artwork) return artwork

  const image = coalesceBlob(artwork.image)
  const thumbnail = coalesceBlob(artwork.thumbnail)

  return {
    ...artwork,
    ...(image ? { image } : {}),
    ...(thumbnail ? { thumbnail } : {}),
  }
}

/**
 * Gallery cards and folder previews: thumbnail first, then original.
 */
export function getGalleryImageBlobs(artwork) {
  if (!artwork) return []

  const blobs = []
  const thumbnail = coalesceBlob(artwork.thumbnail)
  const image = coalesceBlob(artwork.image)

  if (thumbnail) blobs.push(thumbnail)
  if (image && image !== thumbnail) blobs.push(image)

  return blobs
}

export function getGalleryImageBlob(artwork) {
  return getGalleryImageBlobs(artwork)[0] ?? null
}

/**
 * Detail, lightbox, and edit preview: original first, then thumbnail.
 */
export function getFullImageBlobs(artwork) {
  if (!artwork) return []

  const blobs = []
  const image = coalesceBlob(artwork.image)
  const thumbnail = coalesceBlob(artwork.thumbnail)

  if (image) blobs.push(image)
  if (thumbnail && thumbnail !== image) blobs.push(thumbnail)

  return blobs
}

export function getFullImageBlob(artwork) {
  return getFullImageBlobs(artwork)[0] ?? null
}

export function readFileAsBlob(file) {
  return new Promise((resolve, reject) => {
    if (!isValidImageFile(file)) {
      reject(new Error('Please select a valid image file (JPEG, PNG, WebP, or GIF).'))
      return
    }
    resolve(file)
  })
}

/**
 * Create a JPEG thumbnail via the canonical normalization pipeline.
 */
export async function createThumbnail(blob, maxSize = THUMBNAIL_MAX_SIZE) {
  const source = coalesceBlob(blob)
  if (!source) {
    throw new Error('Failed to load image.')
  }

  const normalized = await normalizeArtworkImage(source, { thumbnailMaxEdge: maxSize })
  return normalized.thumbnail
}

export function createObjectUrl(blob) {
  const resolved = coalesceBlob(blob)
  if (!resolved) return null
  return URL.createObjectURL(resolved)
}

export function revokeObjectUrl(url) {
  if (url) URL.revokeObjectURL(url)
}
