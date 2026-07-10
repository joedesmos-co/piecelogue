import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isValidImageBlob, getGalleryImageBlobs } from './imageUtils.js'

describe('imageUtils blob validation', () => {
  it('accepts Blob-like values with zero reported size (mobile Safari quirk)', () => {
    const blob = new Blob(['image-bytes'], { type: 'image/jpeg' })
    Object.defineProperty(blob, 'size', { value: 0 })

    assert.equal(isValidImageBlob(blob), true)
  })

  it('returns gallery candidates from coalesced blobs only', () => {
    const image = new Blob(['full'], { type: 'image/jpeg' })
    const thumbnail = new Blob(['thumb'], { type: 'image/jpeg' })

    const blobs = getGalleryImageBlobs({
      id: 'art-1',
      title: 'Test',
      image,
      thumbnail,
    })

    assert.equal(blobs.length, 2)
    assert.equal(blobs[0], thumbnail)
    assert.equal(blobs[1], image)
  })
})
