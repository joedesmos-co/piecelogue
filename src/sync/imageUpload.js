export const UPLOAD_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const MAX_ORIGINAL_UPLOAD_BYTES = 25 * 1024 * 1024
export const MAX_THUMBNAIL_UPLOAD_BYTES = 2 * 1024 * 1024

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

export function describeImageFormat(mimeType) {
  switch (mimeType) {
    case 'image/jpeg':
      return 'JPEG'
    case 'image/png':
      return 'PNG'
    case 'image/webp':
      return 'WebP'
    case 'image/gif':
      return 'GIF'
    case 'image/heic':
      return 'HEIC'
    case 'image/heif':
      return 'HEIF'
    default:
      return 'unknown'
  }
}

function readAscii(bytes, start, length) {
  return String.fromCharCode(...bytes.slice(start, start + length))
}

export function detectImageFormat(bytes, declaredMimeType = '') {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { format: 'JPEG', mimeType: 'image/jpeg' }
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    readAscii(bytes, 1, 3) === 'PNG'
  ) {
    return { format: 'PNG', mimeType: 'image/png' }
  }

  if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(readAscii(bytes, 0, 6))) {
    return { format: 'GIF', mimeType: 'image/gif' }
  }

  if (
    bytes.length >= 12 &&
    readAscii(bytes, 0, 4) === 'RIFF' &&
    readAscii(bytes, 8, 4) === 'WEBP'
  ) {
    return { format: 'WebP', mimeType: 'image/webp' }
  }

  if (bytes.length >= 12 && readAscii(bytes, 4, 4) === 'ftyp') {
    const brand = readAscii(bytes, 8, 4).toLowerCase()
    if (['heic', 'heix', 'hevc', 'hevx'].includes(brand)) {
      return { format: 'HEIC', mimeType: 'image/heic' }
    }
    if (['heif', 'mif1', 'msf1'].includes(brand)) {
      return { format: 'HEIF', mimeType: 'image/heif' }
    }
  }

  const normalizedMimeType = declaredMimeType.split(';')[0].trim().toLowerCase()
  return {
    format: describeImageFormat(normalizedMimeType),
    mimeType: normalizedMimeType || 'application/octet-stream',
  }
}

export async function prepareBytesForUpload(bytes, details = {}) {
  const normalized = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const byteSize = normalized.byteLength

  if (byteSize === 0) {
    throw new ImageUploadError('Image file is empty.', 'empty_blob', {
      ...details,
      byteSize: 0,
      permanent: true,
    })
  }

  const declaredMimeType = (details.mimeType || '').split(';')[0].trim().toLowerCase()
  const detected = detectImageFormat(normalized, declaredMimeType)
  const mimeType = detected.mimeType
  const format = detected.format

  if (isHeicMimeType(mimeType) || format === 'HEIC' || format === 'HEIF') {
    throw new ImageUploadError(
      'This image format cannot be uploaded yet.',
      'unsupported_format',
      {
        ...details,
        mimeType,
        byteSize,
        permanent: true,
      },
    )
  }

  const maxBytes =
    details.stage === 'thumbnail' ? MAX_THUMBNAIL_UPLOAD_BYTES : MAX_ORIGINAL_UPLOAD_BYTES
  if (byteSize > maxBytes) {
    throw new ImageUploadError('Image is too large to upload.', 'payload_too_large', {
      ...details,
      mimeType,
      byteSize,
      permanent: true,
    })
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

  return {
    body: normalized,
    mimeType,
    format,
    blobSize: byteSize,
    byteSize,
    exceedsLimit: false,
  }
}

export async function prepareBlobForUpload(blob, details = {}) {
  if (blob instanceof Uint8Array || blob instanceof ArrayBuffer) {
    return prepareBytesForUpload(blob, details)
  }
  if (!blob || typeof blob !== 'object') {
    throw new ImageUploadError('Image file is missing.', 'missing_image', {
      ...details,
      permanent: true,
    })
  }

  const blobSize = typeof blob.size === 'number' ? blob.size : null
  let buffer

  try {
    buffer = await blob.arrayBuffer()
  } catch (error) {
    if (error instanceof ImageUploadError) {
      throw error
    }
    throw new ImageUploadError(
      'This image can no longer be read on this device.',
      'unreadable_blob',
      {
        ...details,
        permanent: true,
      },
    )
  }

  const byteSize = buffer.byteLength
  if (byteSize === 0) {
    throw new ImageUploadError('Image file is empty.', 'empty_blob', {
      ...details,
      mimeType: blob.type || null,
      byteSize: 0,
      permanent: true,
    })
  }

  const declaredMimeType = (blob.type || '').split(';')[0].trim().toLowerCase()
  const detected = detectImageFormat(new Uint8Array(buffer), declaredMimeType)
  const mimeType = detected.mimeType
  const format = detected.format

  if (isHeicMimeType(mimeType) || format === 'HEIC' || format === 'HEIF') {
    throw new ImageUploadError(
      'This image format cannot be uploaded yet.',
      'unsupported_format',
      {
        ...details,
        mimeType,
        byteSize,
        permanent: true,
      },
    )
  }

  const maxBytes =
    details.stage === 'thumbnail' ? MAX_THUMBNAIL_UPLOAD_BYTES : MAX_ORIGINAL_UPLOAD_BYTES
  if (byteSize > maxBytes) {
    throw new ImageUploadError('Image is too large to upload.', 'payload_too_large', {
      ...details,
      mimeType,
      byteSize,
      permanent: true,
    })
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

  return {
    body: new Uint8Array(buffer),
    mimeType,
    format,
    blobSize,
    byteSize,
    exceedsLimit: false,
  }
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
