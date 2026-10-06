import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  MERGE_ACTION,
  decideMergeAction,
  isLocalEntityDirty,
  normalizeRevision,
  planImageSyncSteps,
  shouldPullLibrary,
} from './mergeLogic.js'

function remote(overrides = {}) {
  return { id: 'a1', title: 'Cloud', revision: 3, deletedAt: null, ...overrides }
}

function local(overrides = {}) {
  return { id: 'a1', title: 'Local', cloudRevision: 1, ...overrides }
}

describe('normalizeRevision', () => {
  it('normalizes invalid input to zero', () => {
    assert.equal(normalizeRevision(undefined), 0)
    assert.equal(normalizeRevision(null), 0)
    assert.equal(normalizeRevision(-4), 0)
    assert.equal(normalizeRevision('nope'), 0)
  })

  it('floors valid revisions', () => {
    assert.equal(normalizeRevision(7), 7)
    assert.equal(normalizeRevision('5'), 5)
    assert.equal(normalizeRevision(3.9), 3)
  })
})

describe('decideMergeAction: local only / remote only', () => {
  it('imports a remote-only entity', () => {
    assert.equal(decideMergeAction({ local: null, remote: remote() }).action, MERGE_ACTION.IMPORT)
  })

  it('imports a remote-only folder', () => {
    const folder = { id: 'f1', name: 'Traditional', revision: 1, deletedAt: null }
    assert.equal(decideMergeAction({ local: null, remote: folder }).action, MERGE_ACTION.IMPORT)
  })

  it('does not import an already-deleted remote entity', () => {
    const result = decideMergeAction({
      local: null,
      remote: remote({ deletedAt: '2026-07-01' }),
    })
    assert.equal(result.action, MERGE_ACTION.NOOP)
  })
})

describe('decideMergeAction: same revision', () => {
  it('does nothing when revisions match', () => {
    const result = decideMergeAction({
      local: local({ cloudRevision: 3 }),
      remote: remote({ revision: 3 }),
    })
    assert.equal(result.action, MERGE_ACTION.NOOP)
  })

  it('does nothing when revisions match even if the device is dirty', () => {
    const result = decideMergeAction({
      local: local({ cloudRevision: 3 }),
      remote: remote({ revision: 3 }),
      localDirty: true,
    })
    assert.equal(result.action, MERGE_ACTION.NOOP)
  })
})

describe('decideMergeAction: divergence', () => {
  it('applies a strictly newer remote version', () => {
    const result = decideMergeAction({
      local: local({ cloudRevision: 2 }),
      remote: remote({ revision: 5 }),
    })
    assert.equal(result.action, MERGE_ACTION.APPLY_REMOTE)
  })

  it('keeps local when local revision is ahead', () => {
    const result = decideMergeAction({
      local: local({ cloudRevision: 9 }),
      remote: remote({ revision: 4 }),
    })
    assert.equal(result.action, MERGE_ACTION.KEEP_LOCAL)
  })

  it('raises a conflict when both sides changed', () => {
    const result = decideMergeAction({
      local: local({ cloudRevision: 2 }),
      remote: remote({ revision: 6 }),
      localDirty: true,
    })
    assert.equal(result.action, MERGE_ACTION.CONFLICT)
    assert.equal(result.reason, 'both_changed')
  })
})

describe('decideMergeAction: tombstones', () => {
  it('applies a remote delete to a clean local copy', () => {
    const result = decideMergeAction({
      local: local({ cloudRevision: 2 }),
      remote: remote({ revision: 4, deletedAt: '2026-07-01' }),
    })
    assert.equal(result.action, MERGE_ACTION.APPLY_DELETE)
  })

  // Local is behind with unsynced edits: the user worked on this after the last
  // sync while another device deleted it. Must surface, not silently drop work.
  it('flags a conflict when local is behind but has unsynced edits', () => {
    const result = decideMergeAction({
      local: local({ cloudRevision: 1 }),
      remote: remote({ revision: 9, deletedAt: '2026-07-01' }),
      localDirty: true,
    })
    assert.equal(result.action, MERGE_ACTION.CONFLICT)
    assert.equal(result.reason, 'remote_deleted_local_changed')
  })

  // Local is behind but clean (no unsynced work): the delete is safe to apply.
  it('applies a remote delete when local is behind and clean', () => {
    const result = decideMergeAction({
      local: local({ cloudRevision: 1 }),
      remote: remote({ revision: 9, deletedAt: '2026-07-01' }),
      localDirty: false,
    })
    assert.equal(result.action, MERGE_ACTION.APPLY_DELETE)
  })

  // A local record that still has unsynced edits is dirty regardless of how its
  // revision compares to the tombstone, so the delete must never win silently.
  it('flags a conflict when local is dirty even if local is ahead of the delete', () => {
    const result = decideMergeAction({
      local: local({ cloudRevision: 12 }),
      remote: remote({ revision: 5, deletedAt: '2026-07-01' }),
      localDirty: true,
    })
    assert.equal(result.action, MERGE_ACTION.CONFLICT)
    assert.equal(result.reason, 'remote_deleted_local_changed')
  })

  it('applies the delete when local is clean even if local is ahead of it', () => {
    const result = decideMergeAction({
      local: local({ cloudRevision: 12 }),
      remote: remote({ revision: 5, deletedAt: '2026-07-01' }),
      localDirty: false,
    })
    assert.equal(result.action, MERGE_ACTION.APPLY_DELETE)
  })

  it('does not silently delete a locally-changed entity', () => {
    const result = decideMergeAction({
      local: local({ cloudRevision: 2 }),
      remote: remote({ revision: 9, deletedAt: '2026-07-01' }),
      localDirty: true,
    })
    assert.equal(result.action, MERGE_ACTION.CONFLICT)
    assert.equal(result.reason, 'remote_deleted_local_changed')
  })

  it('is idempotent once local has caught up to the delete revision', () => {
    const result = decideMergeAction({
      local: local({ cloudRevision: 9 }),
      remote: remote({ revision: 9, deletedAt: '2026-07-01' }),
      localDirty: false,
    })
    assert.equal(result.action, MERGE_ACTION.APPLY_DELETE)
  })
})

describe('isLocalEntityDirty', () => {
  it('treats a pending job as dirty', () => {
    assert.equal(
      isLocalEntityDirty(local({ cloudRevision: 5 }), {
        pendingEntityIds: new Set(['a1']),
      }),
      true,
    )
  })

  it('treats a never-synced record as dirty', () => {
    assert.equal(isLocalEntityDirty(local({ cloudRevision: 0 }), {}), true)
    assert.equal(isLocalEntityDirty(local({ cloudRevision: undefined }), {}), true)
  })

  it('treats a synced record with no pending work as clean', () => {
    assert.equal(
      isLocalEntityDirty(local({ cloudRevision: 5 }), { pendingEntityIds: new Set() }),
      false,
    )
  })

  it('treats a missing record as clean', () => {
    assert.equal(isLocalEntityDirty(null, { pendingEntityIds: new Set(['a1']) }), false)
  })
})

describe('planImageSyncSteps', () => {
  const hasNone = async () => false
  const hasBoth = async () => true

  it('downloads both kinds when the device has neither', async () => {
    const steps = await planImageSyncSteps(
      [{ id: 'a1', title: 'One', hasOriginal: true, hasThumbnail: true, deletedAt: null }],
      { hasOriginal: hasNone, hasThumbnail: hasNone },
    )
    assert.deepEqual(
      steps.map((s) => s.type).sort(),
      ['original', 'thumbnail'],
    )
  })

  it('downloads nothing when the device already has both', async () => {
    const steps = await planImageSyncSteps(
      [{ id: 'a1', title: 'One', hasOriginal: true, hasThumbnail: true, deletedAt: null }],
      { hasOriginal: hasBoth, hasThumbnail: hasBoth },
    )
    assert.equal(steps.length, 0)
  })

  it('downloads only the missing kind', async () => {
    const steps = await planImageSyncSteps(
      [{ id: 'a1', title: 'One', hasOriginal: true, hasThumbnail: true, deletedAt: null }],
      { hasOriginal: hasBoth, hasThumbnail: hasNone },
    )
    assert.equal(steps.length, 1)
    assert.equal(steps[0].type, 'thumbnail')
  })

  it('never downloads images for tombstoned artworks', async () => {
    const steps = await planImageSyncSteps(
      [{ id: 'a1', title: 'Gone', hasOriginal: true, hasThumbnail: true, deletedAt: '2026-07-01' }],
      { hasOriginal: hasNone, hasThumbnail: hasNone },
    )
    assert.equal(steps.length, 0)
  })

  it('does not download when the cloud has no image keys', async () => {
    const steps = await planImageSyncSteps(
      [{ id: 'a1', title: 'One', hasOriginal: false, hasThumbnail: false, deletedAt: null }],
      { hasOriginal: hasNone, hasThumbnail: hasNone },
    )
    assert.equal(steps.length, 0)
  })

  // The syncImageHashes probe is async; awaiting it is what stops duplicate
  // downloads of bytes this device already holds.
  it('awaits an async byte probe before deciding', async () => {
    let probed = 0
    const steps = await planImageSyncSteps(
      [{ id: 'a1', title: 'One', hasOriginal: true, hasThumbnail: false, deletedAt: null }],
      {
        hasOriginal: async () => {
          probed += 1
          return true
        },
        hasThumbnail: async () => false,
      },
    )
    assert.equal(probed, 1)
    assert.equal(steps.length, 0)
  })
})

describe('shouldPullLibrary', () => {
  const base = {
    folderCount: 1,
    artworkCount: 2,
    artworkWithOriginalCount: 2,
    artworkWithThumbnailCount: 2,
    lastSavedAt: '2026-07-18T00:00:00.000Z',
  }

  it('pulls when there is no previous status to compare against', () => {
    assert.equal(
      shouldPullLibrary({ cloudStatus: base, lastSeenCloudStatus: null, hasPendingLocalWork: false }),
      true,
    )
  })

  it('pulls when there is no cloud status at all', () => {
    assert.equal(
      shouldPullLibrary({ cloudStatus: null, lastSeenCloudStatus: null, hasPendingLocalWork: false }),
      true,
    )
  })

  it('skips when nothing changed', () => {
    assert.equal(
      shouldPullLibrary({ cloudStatus: base, lastSeenCloudStatus: base, hasPendingLocalWork: false }),
      false,
    )
  })

  it('pulls when the artwork count changed', () => {
    assert.equal(
      shouldPullLibrary({
        cloudStatus: { ...base, artworkCount: 3 },
        lastSeenCloudStatus: base,
        hasPendingLocalWork: false,
      }),
      true,
    )
  })

  it('pulls when an image count changed', () => {
    assert.equal(
      shouldPullLibrary({
        cloudStatus: { ...base, artworkWithOriginalCount: 1 },
        lastSeenCloudStatus: base,
        hasPendingLocalWork: false,
      }),
      true,
    )
  })

  it('pulls when lastSavedAt moved', () => {
    assert.equal(
      shouldPullLibrary({
        cloudStatus: { ...base, lastSavedAt: '2026-07-19T00:00:00.000Z' },
        lastSeenCloudStatus: base,
        hasPendingLocalWork: false,
      }),
      true,
    )
  })

  it('always pulls when this device has pending work', () => {
    assert.equal(
      shouldPullLibrary({ cloudStatus: base, lastSeenCloudStatus: base, hasPendingLocalWork: true }),
      true,
    )
  })
})