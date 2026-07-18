import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ImageImportError,
  isAcceptedImportFile,
  isHeicLikeFile,
  prepareArtworkImageForSave,
} from './heicImport.js'
import { detectImageFormat } from '../sync/imageUpload.js'

describe('HEIC import shim', () => {
  it('re-exports acceptance helpers from imageNormalize', () => {
    assert.equal(isHeicLikeFile({ type: 'image/heic', name: 'photo.jpg' }), true)
    assert.equal(isHeicLikeFile({ type: 'image/jpeg', name: 'photo.heic' }), true)
    assert.equal(isHeicLikeFile({ type: 'image/jpeg', name: 'photo.jpg' }), false)
    assert.equal(isAcceptedImportFile({ type: 'image/heic', name: 'photo.heic' }), true)
    assert.equal(isAcceptedImportFile({ type: 'image/jpeg', name: 'photo.jpg' }), true)
    assert.equal(isAcceptedImportFile({ type: 'application/pdf', name: 'doc.pdf' }), false)
  })

  it('detects HEIC bytes even without MIME type', () => {
    const heicBytes = new Uint8Array([
      0, 0, 0, 24,
      0x66, 0x74, 0x79, 0x70,
      0x68, 0x65, 0x69, 0x63,
      0, 0, 0, 0,
    ])
    const detected = detectImageFormat(heicBytes, '')
    assert.equal(detected.format, 'HEIC')
    assert.equal(detected.mimeType, 'image/heic')
  })

  it('exposes ImageImportError compatibility alias', () => {
    const error = new ImageImportError('fail', 'heic_conversion_failed')
    assert.equal(error.name, 'ImageImportError')
    assert.equal(error.code, 'heic_conversion_failed')
  })

  it('prepareArtworkImageForSave remains available', () => {
    assert.equal(typeof prepareArtworkImageForSave, 'function')
  })
})
