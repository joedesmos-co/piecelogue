import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { deleteAllUserCloudData } from './storage.js'

function createMockDb({ artworks = [], folderChanges = 0 } = {}) {
  const runs = []

  return {
    runs,
    prepare(sql) {
      return {
        bind(...args) {
          runs.push({ sql, args })

          if (sql.includes('FROM artworks')) {
            return {
              async all() {
                return { results: artworks }
              },
            }
          }

          if (sql.includes('UPDATE folders')) {
            return {
              async run() {
                return { meta: { changes: folderChanges } }
              },
            }
          }

          return {
            async run() {
              return {}
            },
          }
        },
      }
    },
  }
}

function createMockBucket() {
  const deleted = []
  return {
    deleted,
    async delete(key) {
      deleted.push(key)
    },
  }
}

describe('deleteAllUserCloudData', () => {
  it('tombstones artworks and folders and deletes R2 objects', async () => {
    const db = createMockDb({
      artworks: [
        {
          id: 'art-1',
          original_object_key: 'users/u/artworks/art-1/original.png',
          thumbnail_object_key: 'users/u/artworks/art-1/thumbnail.jpg',
          deleted_at: null,
        },
      ],
      folderChanges: 2,
    })
    const bucket = createMockBucket()

    const result = await deleteAllUserCloudData(db, bucket, 'user-1')

    assert.equal(result.artworksTombstoned, 1)
    assert.equal(result.foldersTombstoned, 2)
    assert.equal(result.r2Deleted, 2)
    assert.deepEqual(bucket.deleted, [
      'users/u/artworks/art-1/original.png',
      'users/u/artworks/art-1/thumbnail.jpg',
    ])
    assert.equal(
      db.runs.some((entry) => entry.sql.includes('UPDATE artworks') && entry.args.includes('art-1')),
      true,
    )
    assert.equal(db.runs.some((entry) => entry.sql.includes('UPDATE folders')), true)
  })

  it('cleans up lingering R2 keys for already tombstoned artworks', async () => {
    const db = createMockDb({
      artworks: [
        {
          id: 'art-2',
          original_object_key: 'users/u/artworks/art-2/original.png',
          thumbnail_object_key: null,
          deleted_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      folderChanges: 0,
    })
    const bucket = createMockBucket()

    const result = await deleteAllUserCloudData(db, bucket, 'user-1')

    assert.equal(result.artworksTombstoned, 0)
    assert.equal(result.r2Deleted, 1)
    assert.deepEqual(bucket.deleted, ['users/u/artworks/art-2/original.png'])
  })
})
