/**
 * Canonical Piecelogue image normalization.
 *
 * Every imported image is decoded, drawn to a canvas, and exported as JPEG
 * before durable storage, hashing, thumbnails, sync, restore, or render.
 */

export class ImageNormalizeError extends Error {
  constructor(message, code = 'unsupported_format', details = {}) {
    super(message)
    this.name = 'ImageNormalizeError'
    this.code = code
    this.sourceFormat = details.sourceFormat ?? null
    this.sourceMimeType = details.sourceMimeType ?? null
  }
}

/** @deprecated Use ImageNormalizeError */
export class ImageImportError extends ImageNormalizeError {
  constructor(message, code = 'unsupported_format', details = {}) {
    super(message, code, details)
    this.name = 'ImageImportError'
  }
}

export const ORIGINAL_JPEG_QUALITY = 0.92
export const THUMBNAIL_JPEG_QUALITY = 0.85
export const THUMBNAIL_MAX_EDGE = 400
export const MAX_ORIGINAL_EDGE = 4096

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.heic',
  '.heif',
  '.bmp',
  '.tif',
  '.tiff',
  '.avif',
  '.ico',
])

const NON_IMAGE_MIME_PREFIXES = ['application/', 'text/', 'audio/', 'video/', 'font/']

export function getFileExtension(name = '') {
  const match = String(name).toLowerCase().match(/(\.[a-z0-9]+)$/)
  return match ? match[1] : ''
}

export function isAcceptedImportFile(file) {
  if (!file) {
    return false
  }

  const mime = (file.type || '').split(';')[0].trim().toLowerCase()
  if (mime.startsWith('image/')) {
    return true
  }

  if (!mime) {
    return IMAGE_EXTENSIONS.has(getFileExtension(file.name))
  }

  return false
}

export function computeScaledSize(width, height, maxEdge) {
  const w = Math.max(1, Math.round(Number(width) || 0))
  const h = Math.max(1, Math.round(Number(height) || 0))
  if (!maxEdge || (w <= maxEdge && h <= maxEdge)) {
    return { width: w, height: h, scaled: false }
  }

  const ratio = Math.min(maxEdge / w, maxEdge / h)
  return {
    width: Math.max(1, Math.round(w * ratio)),
    height: Math.max(1, Math.round(h * ratio)),
    scaled: true,
  }
}

function readAscii(bytes, start, length) {
  return String.fromCharCode(...bytes.slice(start, start + length))
}

export function detectSourceImageFormat(bytes, declaredMimeType = '') {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { format: 'JPEG', mimeType: 'image/jpeg' }
  }

  if (bytes.length >= 8 && bytes[0] === 0x89 && readAscii(bytes, 1, 3) === 'PNG') {
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
    if (brand === 'avif' || brand === 'avis') {
      return { format: 'AVIF', mimeType: 'image/avif' }
    }
  }

  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return { format: 'BMP', mimeType: 'image/bmp' }
  }

  if (
    bytes.length >= 4 &&
    ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a))
  ) {
    return { format: 'TIFF', mimeType: 'image/tiff' }
  }

  const normalizedMimeType = declaredMimeType.split(';')[0].trim().toLowerCase()
  if (normalizedMimeType.startsWith('image/')) {
    return {
      format: normalizedMimeType.replace('image/', '').toUpperCase(),
      mimeType: normalizedMimeType,
    }
  }

  return {
    format: 'unknown',
    mimeType: normalizedMimeType || 'application/octet-stream',
  }
}

function createDrawingCanvas(width, height, deps = {}) {
  if (typeof deps.createCanvas === 'function') {
    return deps.createCanvas(width, height)
  }

  if (typeof OffscreenCanvas === 'function') {
    return new OffscreenCanvas(width, height)
  }

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
  }

  throw new ImageNormalizeError(
    'This browser cannot process images (no canvas support).',
    'normalize_unavailable',
  )
}

async function canvasToJpegBlob(canvas, quality, deps = {}) {
  if (typeof deps.canvasToBlob === 'function') {
    return deps.canvasToBlob(canvas, 'image/jpeg', quality)
  }

  if (typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type: 'image/jpeg', quality })
  }

  if (typeof canvas.toBlob === 'function') {
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', quality)
    })
    return blob
  }

  throw new ImageNormalizeError(
    'This browser cannot export JPEG images.',
    'normalize_unavailable',
  )
}

function getDrawableSize(source) {
  return {
    width: source.displayWidth || source.naturalWidth || source.videoWidth || source.width || 0,
    height:
      source.displayHeight || source.naturalHeight || source.videoHeight || source.height || 0,
  }
}

async function drawSourceToJpeg(source, options = {}, deps = {}) {
  const { width: sourceWidth, height: sourceHeight } = getDrawableSize(source)
  if (!sourceWidth || !sourceHeight) {
    throw new ImageNormalizeError(
      'Could not read image dimensions. Please try another file.',
      'corrupt_image',
    )
  }

  const sized = computeScaledSize(sourceWidth, sourceHeight, options.maxEdge)
  const canvas = createDrawingCanvas(sized.width, sized.height, deps)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new ImageNormalizeError(
      'This browser cannot process images (no 2D canvas).',
      'normalize_unavailable',
    )
  }

  // Opaque white backdrop so transparent PNG/WebP/GIF become solid JPEG.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, sized.width, sized.height)
  ctx.drawImage(source, 0, 0, sized.width, sized.height)

  const blob = await canvasToJpegBlob(canvas, options.quality ?? ORIGINAL_JPEG_QUALITY, deps)
  if (!blob || blob.size === 0) {
    throw new ImageNormalizeError(
      'Could not convert this image to JPEG. Please try another file.',
      'normalize_failed',
    )
  }

  return {
    blob,
    width: sized.width,
    height: sized.height,
    scaled: sized.scaled,
  }
}

async function decodeWithImageDecoder(bytes, mimeType, deps = {}) {
  const ImageDecoderCtor = deps.ImageDecoder ?? globalThis.ImageDecoder
  if (typeof ImageDecoderCtor !== 'function') {
    return null
  }

  try {
    const decoder = new ImageDecoderCtor({
      data: bytes,
      type: mimeType || 'image/jpeg',
    })
    const result = await decoder.decode({ frameIndex: 0 })
    decoder.close?.()
    return result?.image ?? null
  } catch {
    return null
  }
}

async function decodeWithCreateImageBitmap(blob, deps = {}) {
  const createBitmap = deps.createImageBitmap ?? globalThis.createImageBitmap
  if (typeof createBitmap !== 'function') {
    return null
  }

  try {
    return await createBitmap(blob)
  } catch {
    return null
  }
}

async function decodeWithImageElement(blob, deps = {}) {
  const ImageCtor = deps.Image ?? globalThis.Image
  if (typeof ImageCtor !== 'function' || typeof URL === 'undefined') {
    return null
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const img = new ImageCtor()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

async function decodeImageSource(bytes, mimeType, blob, deps = {}) {
  const viaDecoder = await decodeWithImageDecoder(bytes, mimeType, deps)
  if (viaDecoder) {
    return { source: viaDecoder, method: 'ImageDecoder' }
  }

  const viaBitmap = await decodeWithCreateImageBitmap(blob, deps)
  if (viaBitmap) {
    return { source: viaBitmap, method: 'createImageBitmap' }
  }

  const viaImage = await decodeWithImageElement(blob, deps)
  if (viaImage) {
    return { source: viaImage, method: 'Image' }
  }

  return null
}

function closeSource(source) {
  try {
    source?.close?.()
  } catch {
    // Ignore close failures on VideoFrame/ImageBitmap.
  }
}

function rejectNonImageMime(mimeType, sourceFormat) {
  const mime = (mimeType || '').toLowerCase()
  if (!mime || mime === 'application/octet-stream') {
    return
  }
  if (mime.startsWith('image/')) {
    return
  }
  if (NON_IMAGE_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) {
    throw new ImageNormalizeError(
      'Unsupported file type. Please choose an image file.',
      'unsupported_format',
      { sourceFormat, sourceMimeType: mime },
    )
  }
}

/**
 * Normalize any browser-decodable image into Piecelogue JPEG originals + thumbnails.
 */
export async function normalizeArtworkImage(fileOrBlob, options = {}, deps = {}) {
  if (!fileOrBlob) {
    throw new ImageNormalizeError('An artwork image is required.', 'missing_image')
  }

  const declaredMime = (fileOrBlob.type || '').split(';')[0].trim().toLowerCase()
  let buffer
  try {
    buffer = await fileOrBlob.arrayBuffer()
  } catch {
    throw new ImageNormalizeError(
      'Could not read this image file. Please try another file.',
      'unreadable_blob',
    )
  }

  if (!buffer || buffer.byteLength === 0) {
    throw new ImageNormalizeError('Image file is empty.', 'empty_image')
  }

  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const detected = detectSourceImageFormat(bytes, declaredMime)
  rejectNonImageMime(detected.mimeType || declaredMime, detected.format)

  const sourceBlob = new Blob([bytes], {
    type: detected.mimeType?.startsWith('image/')
      ? detected.mimeType
      : declaredMime.startsWith('image/')
        ? declaredMime
        : 'application/octet-stream',
  })

  const decoded = await decodeImageSource(
    bytes,
    sourceBlob.type,
    sourceBlob,
    deps,
  )

  if (!decoded) {
    const heicHint =
      detected.format === 'HEIC' || detected.format === 'HEIF'
        ? ' This HEIC/HEIF image cannot be decoded in this browser. Export it as JPEG or PNG and try again.'
        : ''
    throw new ImageNormalizeError(
      `This image format could not be decoded.${heicHint} Please try JPEG, PNG, or WebP.`,
      detected.format === 'unknown' ? 'unsupported_format' : 'normalize_failed',
      {
        sourceFormat: detected.format,
        sourceMimeType: detected.mimeType,
      },
    )
  }

  try {
    const original = await drawSourceToJpeg(
      decoded.source,
      {
        maxEdge: options.maxOriginalEdge ?? MAX_ORIGINAL_EDGE,
        quality: options.originalQuality ?? ORIGINAL_JPEG_QUALITY,
      },
      deps,
    )

    const thumbnail = await drawSourceToJpeg(
      decoded.source,
      {
        maxEdge: options.thumbnailMaxEdge ?? THUMBNAIL_MAX_EDGE,
        quality: options.thumbnailQuality ?? THUMBNAIL_JPEG_QUALITY,
      },
      deps,
    )

    return {
      original: original.blob,
      thumbnail: thumbnail.blob,
      width: original.width,
      height: original.height,
      thumbnailWidth: thumbnail.width,
      thumbnailHeight: thumbnail.height,
      scaled: original.scaled,
      sourceFormat: detected.format,
      sourceMimeType: detected.mimeType,
      mimeType: 'image/jpeg',
      decodeMethod: decoded.method,
    }
  } finally {
    closeSource(decoded.source)
  }
}

/** Back-compat: return only the normalized original JPEG blob. */
export async function prepareArtworkImageForSave(fileOrBlob, options = {}, deps = {}) {
  const normalized = await normalizeArtworkImage(fileOrBlob, options, deps)
  return normalized.original
}

export async function convertHeicLikeToJpeg(blob, options = {}, deps = {}) {
  return prepareArtworkImageForSave(blob, options, deps)
}

export function isHeicLikeFile(file) {
  if (!file) {
    return false
  }
  const mime = (file.type || '').split(';')[0].trim().toLowerCase()
  if (mime === 'image/heic' || mime === 'image/heif') {
    return true
  }
  const ext = getFileExtension(file.name)
  return ext === '.heic' || ext === '.heif'
}
