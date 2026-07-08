const THUMBNAIL_MAX_SIZE = 400
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export function isValidImageFile(file) {
  return file && ACCEPTED_TYPES.includes(file.type)
}

export function isValidImageBlob(value) {
  if (!value || typeof value !== 'object') return false
  const size = typeof value.size === 'number' ? value.size : 0
  if (size <= 0) return false
  return (
    value instanceof Blob ||
    value instanceof File ||
    Object.prototype.toString.call(value) === '[object Blob]'
  )
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

  const record = coalesceArtworkBlobs(artwork)
  const blobs = []

  if (record.thumbnail) blobs.push(record.thumbnail)
  if (record.image && record.image !== record.thumbnail) blobs.push(record.image)

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

  const record = coalesceArtworkBlobs(artwork)
  const blobs = []

  if (record.image) blobs.push(record.image)
  if (record.thumbnail && record.thumbnail !== record.image) {
    blobs.push(record.thumbnail)
  }

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

export function createThumbnail(blob, maxSize = THUMBNAIL_MAX_SIZE) {
  return new Promise((resolve, reject) => {
    const source = coalesceBlob(blob)
    if (!source) {
      reject(new Error('Failed to load image.'))
      return
    }

    const img = new Image()
    const url = URL.createObjectURL(source)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (thumbnailBlob) => {
          if (thumbnailBlob) {
            resolve(thumbnailBlob)
          } else {
            reject(new Error('Failed to create thumbnail.'))
          }
        },
        'image/jpeg',
        0.85,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image.'))
    }

    img.src = url
  })
}

export function createObjectUrl(blob) {
  const resolved = coalesceBlob(blob)
  if (!resolved) return null
  return URL.createObjectURL(resolved)
}

export function revokeObjectUrl(url) {
  if (url) URL.revokeObjectURL(url)
}
