import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getArtworkObjectKeys,
  getOriginalObjectKey,
  getThumbnailObjectKey,
  mapCloudArtworkRow,
  mapCloudFolderRow,
} from './storage.js'

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

describe('cloud library row mapping', () => {
  it('maps folder rows including parent_folder_id', () => {
    const folder = mapCloudFolderRow({
      id: 'folder-1',
      name: 'Sketches',
      parent_folder_id: 'folder-root',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
    })

    assert.equal(folder.id, 'folder-1')
    assert.equal(folder.parentFolderId, 'folder-root')
    assert.equal(folder.revision, 1)

    const topLevel = mapCloudFolderRow({
      id: 'folder-2',
      name: 'Top',
      parent_folder_id: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    })
    assert.equal(topLevel.parentFolderId, null)
  })

  it('maps artwork rows with image availability flags but no blobs', () => {
    const artwork = mapCloudArtworkRow({
      id: 'art-1',
      folder_id: 'folder-1',
      title: 'Portrait',
      medium_type: 'Digital',
      medium: 'Procreate',
      status: 'Finished',
      hours: 1,
      minutes: 15,
      total_minutes: 75,
      artwork_date: '2026-01-01',
      notes: '',
      favorite: 1,
      original_object_key: 'users/u/artworks/art-1/original.png',
      thumbnail_object_key: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
    })

    assert.equal(artwork.hasOriginal, true)
    assert.equal(artwork.hasThumbnail, false)
    assert.equal(artwork.favorite, true)
    assert.equal(artwork.folderId, 'folder-1')
    assert.equal(artwork.revision, 1)
    assert.equal('original_object_key' in artwork, false)
  })
})

describe('cloud artwork metadata upsert', () => {
  it('preserves R2 object keys on metadata-only SQL updates', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const { dirname, join } = await import('node:path')
    const storagePath = join(dirname(fileURLToPath(import.meta.url)), 'storage.js')
    const source = readFileSync(storagePath, 'utf8')
    const updateMatch = source.match(/if \(existing\) \{[\s\S]*?UPDATE artworks[\s\S]*?WHERE id = \? AND user_id = \?/)

    assert.ok(updateMatch, 'Expected artwork metadata UPDATE statement')
    assert.doesNotMatch(updateMatch[0], /original_object_key\s*=/)
    assert.doesNotMatch(updateMatch[0], /thumbnail_object_key\s*=/)
  })
})

describe('cloud delete helpers', () => {
  it('collects artwork R2 object keys for cleanup', () => {
    assert.deepEqual(
      getArtworkObjectKeys({
        original_object_key: 'users/u/artworks/a1/original.png',
        thumbnail_object_key: 'users/u/artworks/a1/thumbnail.jpg',
      }),
      ['users/u/artworks/a1/original.png', 'users/u/artworks/a1/thumbnail.jpg'],
    )
    assert.deepEqual(getArtworkObjectKeys({ original_object_key: null, thumbnail_object_key: null }), [])
  })

  it('maps only active cloud library rows without deleted_at', () => {
    const activeFolder = mapCloudFolderRow({
      id: 'folder-1',
      name: 'Sketches',
      parent_folder_id: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
    })

    assert.equal(activeFolder.id, 'folder-1')
    assert.equal('deleted_at' in activeFolder, false)
  })
})
