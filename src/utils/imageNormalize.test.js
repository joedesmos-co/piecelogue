import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ImageNormalizeError,
  computeScaledSize,
  detectSourceImageFormat,
  isAcceptedImportFile,
  isHeicLikeFile,
  normalizeArtworkImage,
  prepareArtworkImageForSave,
} from './imageNormalize.js'
import { prepareBytesForUpload } from '../sync/imageUpload.js'
import { hashBytes } from '../sync/imageHash.js'

function jpegBytes() {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46])
}

function pngBytes() {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
}

function webpBytes() {
  return new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
  ])
}

function gifBytes() {
  return new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0])
}

function heicBytes() {
  return new Uint8Array([
    0, 0, 0, 24,
    0x66, 0x74, 0x79, 0x70,
    0x68, 0x65, 0x69, 0x63,
    0, 0, 0, 0,
  ])
}

function makeDrawable(width, height) {
  return {
    width,
    height,
    close() {},
  }
}

function makeNormalizeDeps({ width = 800, height = 600, failDecode = false } = {}) {
  const jpegPayload = new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 1, 2, 3, 4])
  return {
    createImageBitmap: async () => {
      if (failDecode) {
        throw new Error('decode failed')
      }
      return makeDrawable(width, height)
    },
    ImageDecoder: undefined,
    Image: undefined,
    createCanvas: (w, h) => ({
      width: w,
      height: h,
      getContext: () => ({
        fillStyle: '',
        fillRect() {},
        drawImage() {},
      }),
    }),
    canvasToBlob: async () => new Blob([jpegPayload], { type: 'image/jpeg' }),
  }
}

describe('image normalize acceptance', () => {
  it('accepts common browser image types and extensions', () => {
    assert.equal(isAcceptedImportFile({ type: 'image/jpeg', name: 'a.jpg' }), true)
    assert.equal(isAcceptedImportFile({ type: 'image/png', name: 'a.png' }), true)
    assert.equal(isAcceptedImportFile({ type: 'image/webp', name: 'a.webp' }), true)
    assert.equal(isAcceptedImportFile({ type: 'image/gif', name: 'a.gif' }), true)
    assert.equal(isAcceptedImportFile({ type: 'image/bmp', name: 'a.bmp' }), true)
    assert.equal(isAcceptedImportFile({ type: 'image/tiff', name: 'a.tif' }), true)
    assert.equal(isAcceptedImportFile({ type: 'image/heic', name: 'a.heic' }), true)
    assert.equal(isAcceptedImportFile({ type: '', name: 'photo.heif' }), true)
    assert.equal(isAcceptedImportFile({ type: 'application/pdf', name: 'a.pdf' }), false)
  })

  it('detects JPEG, PNG, WebP, GIF, and HEIC magic bytes', () => {
    assert.equal(detectSourceImageFormat(jpegBytes()).format, 'JPEG')
    assert.equal(detectSourceImageFormat(pngBytes()).format, 'PNG')
    assert.equal(detectSourceImageFormat(webpBytes()).format, 'WebP')
    assert.equal(detectSourceImageFormat(gifBytes()).format, 'GIF')
    assert.equal(detectSourceImageFormat(heicBytes()).format, 'HEIC')
    assert.equal(isHeicLikeFile({ type: 'image/heic', name: 'x.jpg' }), true)
  })
})

describe('image normalize scaling', () => {
  it('scales large images down while preserving aspect ratio', () => {
    const sized = computeScaledSize(8000, 4000, 4096)
    assert.equal(sized.scaled, true)
    assert.equal(sized.width, 4096)
    assert.equal(sized.height, 2048)
  })

  it('leaves small images unscaled', () => {
    const sized = computeScaledSize(800, 600, 4096)
    assert.equal(sized.scaled, false)
    assert.equal(sized.width, 800)
    assert.equal(sized.height, 600)
  })
})

describe('normalizeArtworkImage', () => {
  it('normalizes JPEG into original + thumbnail JPEG blobs', async () => {
    const blob = new Blob([jpegBytes()], { type: 'image/jpeg' })
    const result = await normalizeArtworkImage(blob, {}, makeNormalizeDeps())

    assert.equal(result.mimeType, 'image/jpeg')
    assert.equal(result.sourceFormat, 'JPEG')
    assert.equal(result.original.type, 'image/jpeg')
    assert.equal(result.thumbnail.type, 'image/jpeg')
    assert.ok(result.original.size > 0)
    assert.ok(result.thumbnail.size > 0)
    assert.equal(result.width, 800)
    assert.equal(result.thumbnailWidth <= 400, true)
  })

  it('normalizes PNG into JPEG', async () => {
    const blob = new Blob([pngBytes()], { type: 'image/png' })
    const result = await normalizeArtworkImage(blob, {}, makeNormalizeDeps())
    assert.equal(result.sourceFormat, 'PNG')
    assert.equal(result.mimeType, 'image/jpeg')
  })

  it('normalizes WebP into JPEG', async () => {
    const blob = new Blob([webpBytes()], { type: 'image/webp' })
    const result = await normalizeArtworkImage(blob, {}, makeNormalizeDeps())
    assert.equal(result.sourceFormat, 'WebP')
    assert.equal(result.mimeType, 'image/jpeg')
  })

  it('normalizes GIF into JPEG', async () => {
    const blob = new Blob([gifBytes()], { type: 'image/gif' })
    const result = await normalizeArtworkImage(blob, {}, makeNormalizeDeps())
    assert.equal(result.sourceFormat, 'GIF')
    assert.equal(result.mimeType, 'image/jpeg')
  })

  it('normalizes HEIC when decoding is supported', async () => {
    const blob = new Blob([heicBytes()], { type: 'image/heic' })
    const result = await normalizeArtworkImage(blob, {}, makeNormalizeDeps())
    assert.equal(result.sourceFormat, 'HEIC')
    assert.equal(result.mimeType, 'image/jpeg')
  })

  it('rejects HEIC when decoding is unsupported', async () => {
    const blob = new Blob([heicBytes()], { type: 'image/heic' })
    await assert.rejects(
      () => normalizeArtworkImage(blob, {}, makeNormalizeDeps({ failDecode: true })),
      (error) =>
        error instanceof ImageNormalizeError &&
        (error.code === 'normalize_failed' || error.code === 'unsupported_format'),
    )
  })

  it('rejects unsupported non-image formats', async () => {
    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' })
    await assert.rejects(
      () => normalizeArtworkImage(blob, {}, makeNormalizeDeps()),
      (error) => error instanceof ImageNormalizeError && error.code === 'unsupported_format',
    )
  })

  it('rejects corrupt undecodable images', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'image/jpeg' })
    await assert.rejects(
      () => normalizeArtworkImage(blob, {}, makeNormalizeDeps({ failDecode: true })),
      (error) => error instanceof ImageNormalizeError,
    )
  })

  it('scales large originals during normalization', async () => {
    const blob = new Blob([jpegBytes()], { type: 'image/jpeg' })
    const result = await normalizeArtworkImage(
      blob,
      { maxOriginalEdge: 1024 },
      makeNormalizeDeps({ width: 4000, height: 3000 }),
    )
    assert.equal(result.scaled, true)
    assert.equal(result.width, 1024)
    assert.equal(result.height, 768)
  })

  it('generates a smaller thumbnail than the original edge limit', async () => {
    const blob = new Blob([jpegBytes()], { type: 'image/jpeg' })
    const result = await normalizeArtworkImage(
      blob,
      { thumbnailMaxEdge: 200 },
      makeNormalizeDeps({ width: 1600, height: 1200 }),
    )
    assert.equal(result.thumbnailWidth, 200)
    assert.equal(result.thumbnailHeight, 150)
  })
})

describe('sync after normalization', () => {
  it('hashes and prepares normalized JPEG bytes for upload', async () => {
    const blob = new Blob([jpegBytes()], { type: 'image/jpeg' })
    const normalized = await normalizeArtworkImage(blob, {}, makeNormalizeDeps())
    const originalBytes = new Uint8Array(await normalized.original.arrayBuffer())
    const prepared = await prepareBytesForUpload(originalBytes, {
      stage: 'original',
      mimeType: 'image/jpeg',
    })
    const hash = await hashBytes(prepared.body)

    assert.equal(prepared.mimeType, 'image/jpeg')
    assert.equal(prepared.format, 'JPEG')
    assert.ok(typeof hash === 'string' && hash.length === 64)
  })

  it('prepareArtworkImageForSave returns only the normalized original', async () => {
    const blob = new Blob([pngBytes()], { type: 'image/png' })
    const prepared = await prepareArtworkImageForSave(blob, {}, makeNormalizeDeps())
    assert.equal(prepared.type, 'image/jpeg')
    assert.ok(prepared.size > 0)
  })
})
