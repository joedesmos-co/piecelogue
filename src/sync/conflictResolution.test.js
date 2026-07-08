import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { toCloudArtworkMetadata, toCloudFolder } from './cloudPayload.js'
import {
  extractUpsertRevision,
  localArtworkFromCloud,
  localFolderFromCloud,
} from './conflictResolutionCore.js'

describe('conflict resolution helpers', () => {
  it('extracts revision from upsert responses', () => {
    const response = {
      results: [
        { id: 'folder-1', revision: 4 },
        { id: 'folder-2', revision: 2 },
      ],
      conflicts: [],
    }

    assert.equal(extractUpsertRevision(response, 'folder-1'), 4)
    assert.equal(extractUpsertRevision(response, 'missing'), null)
  })

  it('maps cloud folder payloads into local records with revision', () => {
    const local = localFolderFromCloud({
      id: 'folder-1',
      name: 'Cloud sketches',
      parentFolderId: 'parent-1',
      revision: 5,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })

    assert.equal(local.name, 'Cloud sketches')
    assert.equal(local.cloudRevision, 5)
    assert.equal(local.parentFolderId, 'parent-1')
  })

  it('maps cloud artwork payloads into local records with revision', () => {
    const local = localArtworkFromCloud({
      id: 'art-1',
      folderId: 'folder-1',
      title: 'Cloud portrait',
      mediumType: 'Digital',
      medium: 'Procreate',
      status: 'Finished',
      revision: 7,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })

    assert.equal(local.title, 'Cloud portrait')
    assert.equal(local.cloudRevision, 7)
  })
})

describe('keep local force upload payloads', () => {
  it('includes force for folder uploads', () => {
    const payload = toCloudFolder(
      {
        id: 'folder-1',
        name: 'Local',
        parentFolderId: null,
        cloudRevision: 1,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-02',
      },
      { force: true },
    )

    assert.equal(payload.force, true)
    assert.equal(payload.baseRevision, 1)
  })

  it('includes force for artwork uploads', () => {
    const payload = toCloudArtworkMetadata(
      {
        id: 'art-1',
        title: 'Local portrait',
        mediumType: 'Digital',
        medium: 'Procreate',
        status: 'In Progress',
        cloudRevision: 2,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-02',
      },
      { force: true },
    )

    assert.equal(payload.force, true)
    assert.equal(payload.baseRevision, 2)
  })
})
