import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getOriginalObjectKey, getThumbnailObjectKey } from './storage.js'

describe('cloud storage keys', () => {
  it('builds user-scoped R2 object keys', () => {
    assert.equal(
      getOriginalObjectKey('user-1', 'art-1', 'image/png'),
      'users/user-1/artworks/art-1/original.png',
    )
    assert.equal(
      getThumbnailObjectKey('user-1', 'art-1'),
      'users/user-1/artworks/art-1/thumbnail.jpg',
    )
  })
})
