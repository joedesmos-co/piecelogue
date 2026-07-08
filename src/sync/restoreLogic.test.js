import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildImageDownloadSteps,
  decideRestoreAction,
  toLocalArtworkMetadata,
  toLocalFolder,
} from './restoreLogic.js'

describe('restore decision', () => {
  it('does nothing when cloud is empty', () => {
    assert.equal(
      decideRestoreAction({
        localCounts: { folderCount: 0, artworkCount: 0 },
        cloudStatus: { folderCount: 0, artworkCount: 0 },
        restoreDismissed: false,
      }),
      'none',
    )
  })

  it('auto-restores when local library is empty and cloud has data', () => {
    assert.equal(
      decideRestoreAction({
        localCounts: { folderCount: 0, artworkCount: 0 },
        cloudStatus: { folderCount: 2, artworkCount: 5 },
        restoreDismissed: false,
      }),
      'auto-restore',
    )
  })

  it('prompts instead of overwriting a non-empty local library', () => {
    assert.equal(
      decideRestoreAction({
        localCounts: { folderCount: 1, artworkCount: 0 },
        cloudStatus: { folderCount: 2, artworkCount: 5 },
        restoreDismissed: false,
      }),
      'prompt',
    )
  })

  it('respects a persisted "keep this device" choice', () => {
    assert.equal(
      decideRestoreAction({
        localCounts: { folderCount: 1, artworkCount: 3 },
        cloudStatus: { folderCount: 2, artworkCount: 5 },
        restoreDismissed: true,
      }),
      'none',
    )
  })
})

describe('restore mappers', () => {
  it('preserves folder UUIDs and parentFolderId for subfolders', () => {
    const folder = toLocalFolder({
      id: 'folder-uuid-1',
      name: 'Character Designs',
      parentFolderId: 'folder-uuid-root',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })

    assert.equal(folder.id, 'folder-uuid-1')
    assert.equal(folder.parentFolderId, 'folder-uuid-root')
  })

  it('normalizes artwork metadata with local field shapes', () => {
    const artwork = toLocalArtworkMetadata({
      id: 'artwork-uuid-1',
      folderId: 'folder-uuid-1',
      title: 'Portrait',
      mediumType: 'Digital',
      medium: 'Procreate',
      status: 'Finished',
      hours: 2,
      minutes: 30,
      totalMinutes: 150,
      artworkDate: '2026-01-01',
      notes: '',
      favorite: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })

    assert.equal(artwork.id, 'artwork-uuid-1')
    assert.equal(artwork.folderId, 'folder-uuid-1')
    assert.equal(artwork.favorite, true)
    assert.equal(artwork.totalMinutes, 150)
  })
})

describe('restore image download plan', () => {
  it('only downloads images the cloud actually has', () => {
    const steps = buildImageDownloadSteps([
      { id: 'a1', title: 'One', hasOriginal: true, hasThumbnail: true },
      { id: 'a2', title: 'Two', hasOriginal: true, hasThumbnail: false },
      { id: 'a3', title: 'Three', hasOriginal: false, hasThumbnail: false },
    ])

    assert.equal(steps.length, 3)
    assert.deepEqual(
      steps.map((step) => `${step.artworkId}:${step.type}`),
      ['a1:original', 'a1:thumbnail', 'a2:original'],
    )
  })
})
