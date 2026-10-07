import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  THUMBNAIL_MAX_EDGE,
  getRequiredThumbnailEdge,
  isThumbnailUpscaled,
} from './imageNormalize.js'
import {
  GALLERY_CARD_CSS_WIDTH,
  selectGallerySource,
} from './imageUtils.js'

describe('thumbnail dimensions for retina gallery cards', () => {
  it('generates thumbnails sized for DPR 3 phone layouts', () => {
    // Two-column iPhone layout: ~166 CSS px per card at DPR 3 needs ~500 px.
    assert.ok(
      THUMBNAIL_MAX_EDGE >= getRequiredThumbnailEdge(166, 3),
      `thumbnail edge ${THUMBNAIL_MAX_EDGE} must cover 166css*3dpr`,
    )
  })

  it('covers desktop densities without reckless sizes', () => {
    assert.ok(THUMBNAIL_MAX_EDGE >= getRequiredThumbnailEdge(250, 2))
    assert.ok(THUMBNAIL_MAX_EDGE <= 1024, 'thumbnail must stay small')
  })

  it('flags upscaling of the legacy 400px thumbnail on retina', () => {
    assert.equal(isThumbnailUpscaled(400, 166, 3), true)
    assert.equal(isThumbnailUpscaled(640, 166, 3), false)
  })

  it('does not flag downscaling as upscaling', () => {
    assert.equal(isThumbnailUpscaled(640, 250, 1), false)
    assert.equal(isThumbnailUpscaled(640, 120, 3), false)
  })
})

describe('gallery source selection', () => {
  it('prefers the thumbnail when it covers the display size', () => {
    assert.equal(
      selectGallerySource({
        thumbnailWidth: 640,
        hasOriginal: true,
        displayCssWidth: 166,
        devicePixelRatio: 3,
      }),
      'thumbnail',
    )
  })

  it('falls back to the original instead of upscaling a tiny thumbnail', () => {
    assert.equal(
      selectGallerySource({
        thumbnailWidth: 200,
        hasOriginal: true,
        displayCssWidth: 250,
        devicePixelRatio: 2,
      }),
      'original',
    )
  })

  it('uses detail/full-screen originals, never gallery thumbnails', () => {
    // Detail source order is original-first by contract (see
    // useArtworkImageSource gallery vs detail kinds).
    assert.equal(GALLERY_CARD_CSS_WIDTH, 250)
  })

  it('returns null when no source exists', () => {
    assert.equal(
      selectGallerySource({ thumbnailWidth: 0, hasOriginal: false }),
      null,
    )
  })
})
