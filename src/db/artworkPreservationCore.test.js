import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildMetadataOnlyArtworkRecord,
  preserveArtworkBlobFields,
} from './artworkPreservationCore.js'

describe('artwork blob preservation', () => {
  const image = new Blob(['full-image'], { type: 'image/jpeg' })
  const thumbnail = new Blob(['thumb'], { type: 'image/jpeg' })

  const existing = {
    id: 'art-1',
    title: 'Portrait',
    folderId: null,
    image,
    thumbnail,
    updatedAt: '2026-01-01T00:00:00.000Z',
  }

  it('preserves image and thumbnail on metadata-only folder move', () => {
    const record = buildMetadataOnlyArtworkRecord(existing, {
      folderId: 'folder-1',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })

    assert.equal(record.folderId, 'folder-1')
    assert.equal(record.image, image)
    assert.equal(record.thumbnail, thumbnail)
  })

  it('preserves blobs when moving between folders', () => {
    const firstMove = buildMetadataOnlyArtworkRecord(existing, { folderId: 'folder-a' })
    const secondMove = buildMetadataOnlyArtworkRecord(firstMove, { folderId: 'folder-b' })

    assert.equal(secondMove.folderId, 'folder-b')
    assert.equal(secondMove.image, image)
    assert.equal(secondMove.thumbnail, thumbnail)
  })

  it('does not overwrite blobs when updates omit them', () => {
    const record = preserveArtworkBlobFields(existing, {
      title: 'Renamed',
      favorite: true,
    })

    assert.equal(record.title, 'Renamed')
    assert.equal(record.favorite, true)
    assert.equal(record.image, image)
    assert.equal(record.thumbnail, thumbnail)
  })

  it('allows explicit image replacement when provided', () => {
    const nextImage = new Blob(['replacement'], { type: 'image/png' })
    const record = preserveArtworkBlobFields(existing, { image: nextImage })

    assert.equal(record.image, nextImage)
    assert.equal(record.thumbnail, thumbnail)
  })
})
