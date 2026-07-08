import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildConflictRecord,
  evaluateRevisionConflict,
  normalizeBaseRevision,
  snapshotArtwork,
  snapshotFolder,
} from './conflictLogic.js'

describe('revision normalization', () => {
  it('normalizes invalid base revisions to zero', () => {
    assert.equal(normalizeBaseRevision(undefined), 0)
    assert.equal(normalizeBaseRevision(-1), 0)
    assert.equal(normalizeBaseRevision(2.9), 2)
  })
})

describe('evaluateRevisionConflict', () => {
  const existingFolder = {
    id: 'folder-1',
    revision: 3,
    deleted_at: null,
    name: 'Cloud name',
  }

  it('detects stale revision conflicts', () => {
    const conflict = evaluateRevisionConflict(existingFolder, 2)
    assert.equal(conflict.reason, 'stale_revision')
    assert.equal(conflict.cloudRevision, 3)
  })

  it('detects unknown cloud revision when base revision is zero', () => {
    const conflict = evaluateRevisionConflict(existingFolder, 0)
    assert.equal(conflict.reason, 'cloud_changed_since_last_sync')
    assert.equal(conflict.cloudRevision, 3)
  })

  it('allows matching revisions', () => {
    assert.equal(evaluateRevisionConflict(existingFolder, 3), null)
  })

  it('skips conflict checks when force is true', () => {
    assert.equal(evaluateRevisionConflict(existingFolder, 0, { force: true }), null)
    assert.equal(evaluateRevisionConflict(existingFolder, 1, { force: true }), null)
  })

  it('allows inserts when cloud row is missing or deleted', () => {
    assert.equal(evaluateRevisionConflict(null, 0), null)
    assert.equal(evaluateRevisionConflict({ revision: 2, deleted_at: '2026-01-01' }, 2), null)
  })
})

describe('conflict records and snapshots', () => {
  it('builds conflict records with cloud payload', () => {
    const record = buildConflictRecord({
      id: 'art-1',
      baseRevision: 1,
      cloudRevision: 2,
      cloud: { id: 'art-1', title: 'Cloud title' },
      reason: 'stale_revision',
    })

    assert.equal(record.id, 'art-1')
    assert.equal(record.baseRevision, 1)
    assert.equal(record.cloud.title, 'Cloud title')
  })

  it('snapshots local folder and artwork metadata without blobs', () => {
    const folder = snapshotFolder({
      id: 'folder-1',
      name: 'Sketches',
      parentFolderId: null,
      cloudRevision: 2,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-02',
    })

    assert.equal(folder.name, 'Sketches')
    assert.equal(folder.cloudRevision, 2)
    assert.equal('count' in folder, false)

    const artwork = snapshotArtwork({
      id: 'art-1',
      title: 'Portrait',
      mediumType: 'Digital',
      medium: 'Procreate',
      status: 'Finished',
      cloudRevision: 4,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-02',
    })

    assert.equal(artwork.title, 'Portrait')
    assert.equal(artwork.cloudRevision, 4)
    assert.equal('image' in artwork, false)
  })
})
