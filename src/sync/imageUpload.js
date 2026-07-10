export const UPLOAD_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const HEIC_TYPES = new Set(['image/heic', 'image/heif'])

export class ImageUploadError extends Error {
  constructor(message, code, details = {}) {
    super(message)
    this.name = 'ImageUploadError'
    this.code = code
    this.permanent = details.permanent !== false
    this.stage = details.stage ?? null
    this.artworkTitle = details.artworkTitle ?? null
    this.artworkId = details.artworkId ?? null
    this.mimeType = details.mimeType ?? null
    this.byteSize = details.byteSize ?? null
  }

  toDiagnosticString() {
    const title = this.artworkTitle || this.artworkId || 'Artwork'
    const stage = this.stage ? `${this.stage} image` : 'image'
    const mime = this.mimeType || 'unknown type'
    const size =
      typeof this.byteSize === 'number' ? `${this.byteSize} bytes` : 'unknown size'
    return `${title} (${stage}, ${mime}, ${size}): ${this.message}`
  }
}

export function isHeicMimeType(mimeType) {
  if (!mimeType) {
    return false
  }
  return HEIC_TYPES.has(mimeType.split(';')[0].trim().toLowerCase())
}

export function isSupportedUploadMime(mimeType) {
  if (!mimeType) {
    return true
  }
  return UPLOAD_ALLOWED_TYPES.includes(mimeType.split(';')[0].trim().toLowerCase())
}

export async function prepareBlobForUpload(blob, details = {}) {
  if (!blob || typeof blob !== 'object') {
    throw new ImageUploadError('Image file is missing.', 'missing_image', {
      ...details,
      permanent: true,
    })
  }

  let resolved = blob
  let byteSize = typeof blob.size === 'number' ? blob.size : 0

  if (byteSize === 0) {
    try {
      const buffer = await blob.arrayBuffer()
      byteSize = buffer.byteLength
      if (byteSize === 0) {
        throw new ImageUploadError('Image file is empty.', 'empty_blob', {
          ...details,
          mimeType: blob.type || null,
          byteSize: 0,
          permanent: true,
        })
      }
      resolved = new Blob([buffer], { type: blob.type || 'image/jpeg' })
    } catch (error) {
      if (error instanceof ImageUploadError) {
        throw error
      }
      throw new ImageUploadError('Could not read image file.', 'unreadable_blob', {
        ...details,
        permanent: true,
      })
    }
  }

  const mimeType = (resolved.type || 'image/jpeg').split(';')[0].trim().toLowerCase()

  if (isHeicMimeType(mimeType)) {
    throw new ImageUploadError(
      'Unsupported image format (HEIC). Re-add the artwork as JPEG or PNG.',
      'unsupported_format',
      {
        ...details,
        mimeType,
        byteSize,
        permanent: true,
      },
    )
  }

  if (!isSupportedUploadMime(mimeType)) {
    throw new ImageUploadError(
      `Unsupported image format (${mimeType}). Use JPEG, PNG, WebP, or GIF.`,
      'unsupported_format',
      {
        ...details,
        mimeType,
        byteSize,
        permanent: true,
      },
    )
  }

  return { blob: resolved, mimeType, byteSize }
}

export function describeImageUploadStage(stage) {
  if (stage === 'original') {
    return 'Uploading original image…'
  }
  if (stage === 'thumbnail') {
    return 'Uploading thumbnail…'
  }
  return 'Uploading image…'
}
