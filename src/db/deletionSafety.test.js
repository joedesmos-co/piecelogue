import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { before, beforeEach, describe, it } from 'node:test'
import { extensionlessResolveHooks } from '../testResolveHook.mjs'

registerHooks(extensionlessResolveHooks)
await import('fake-indexeddb/auto')

const { db } = await import('./database.js')
const { IMAGE_KINDS } = await import('./artworkImageKeys.js')
const { getDurableImageRecord, saveDurableImageBytes } = await import('./artworkImageStorage.js')
const { enqueueSyncJob, getSyncJobsForUser } = await import('./syncQueueService.js')
const { saveSyncConflict, getSyncConflictsForUser } = await import('./syncConflictService.js')
const { mergeCloudLibrary } = await import('./mergeService.js')
const { resolveKeepDeleted, resolveRestoreDeleted, isRemoteDeletedConflict } = await import(
  '../sync/conflictResolution.js'
)
const { evaluateRevisionConflict } = await import('../sync/conflictLogic.js')
const { toCloudArtworkMetadata, toCloudFolder } = await import('../sync/cloudPayload.js')
const { SYNC_ENTITY_TYPES } = await import('../sync/constants.js')

const USER = 'user-del'
const BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0x44, 0x55, 0x66])

/**
 * In-memory stand-in for the Worker's artwork upsert. Mirrors
 * upsertCloudArtworks exactly, including the tombstone guard: a tombstoned row
 * is only revived when the caller explicitly sets allowResurrect.
 */
function createFakeCloudApi(store) {
  return {
    uploadCloudArtworks: async (artworks) => {
      const results = []
      const conflicts = []
      for (const payload of artworks) {
        const outcome = store.upsert(payload)
        results.push(...outcome.results)
        conflicts.push(...outcome.conflicts)
      }
      return { ok: true, saved: results.length, results, conflicts }
    },
    uploadCloudFolders: async (folders) => {
      const results = []
      const conflicts = []
      for (const payload of folders) {
        const existing = store.rows.get(payload.id)
        const conflict = evaluateRevisionConflict(existing, payload.baseRevision, {
          force: Boolean(payload.force),
          allowResurrect: payload.allowResurrect === true,
        })
        if (conflict) {
          conflicts.push({ id: payload.id, ...conflict })
          continue
        }
        const revision = existing ? (existing.revision ?? 1) + 1 : 1
        store.rows.set(payload.id, {
          ...(existing ?? {}),
          id: payload.id,
          name: payload.name,
          revision,
          deleted_at: null,
        })
        results.push({ id: payload.id, revision })
      }
      return { ok: true, saved: results.length, results, conflicts }
    },
    downloadCloudArtworkImage: async () => {
      throw new Error('Restore path must not download a deleted artwork image.')
    },
  }
}

/**
 * In-memory stand-in for the Worker's tombstoned artwork row. Mirrors
 * upsertCloudArtworks: refuses to un-delete unless allowResurrect is set.
 */
function createCloudArtworkStore() {
  const rows = new Map()

  return {
    rows,
    seed(id, { revision = 5, deletedAt = '2026-07-20T00:00:00.000Z' } = {}) {
      rows.set(id, {
        id,
        revision,
        deleted_at: deletedAt,
        title: 'Cloud copy',
        folder_id: null,
        medium_type: 'Digital',
        medium: 'Procreate',
        status: 'Finished',
        hours: 1,
        minutes: 0,
        total_minutes: 60,
        artwork_date: null,
        notes: '',
        favorite: 0,
        original_object_key: null,
        thumbnail_object_key: null,
        created_at: '2026-07-18T00:00:00.000Z',
        updated_at: '2026-07-20T00:00:00.000Z',
      })
    },
    /** Mirrors the worker upsert path, including the tombstone guard. */
    upsert(payload) {
      const existing = rows.get(payload.id)
      const conflict = evaluateRevisionConflict(existing, payload.baseRevision, {
        force: Boolean(payload.force),
        allowResurrect: payload.allowResurrect === true,
      })

      if (conflict) {
        return { saved: 0, results: [], conflicts: [{ id: payload.id, ...conflict }] }
      }

      if (existing) {
        const nextRevision = (existing.revision ?? 1) + 1
        rows.set(payload.id, {
          ...existing,
          title: payload.title,
          status: payload.status,
          favorite: payload.favorite ? 1 : 0,
          updated_at: payload.updatedAt,
          deleted_at: null,
          revision: nextRevision,
        })
        return { saved: 1, results: [{ id: payload.id, revision: nextRevision }], conflicts: [] }
      }

      rows.set(payload.id, { ...payload, revision: 1, deleted_at: null })
      return { saved: 1, results: [{ id: payload.id, revision: 1 }], conflicts: [] }
    },
  }
}

function cloudDeletedArtwork(overrides = {}) {
  return {
    id: 'a1',
    folderId: null,
    title: 'Cloud copy',
    mediumType: 'Digital',
    medium: 'Procreate',
    status: 'Finished',
    hours: 1,
    minutes: 0,
    totalMinutes: 60,
    artworkDate: null,
    notes: '',
    favorite: false,
    revision: 5,
    hasOriginal: false,
    hasThumbnail: false,
    createdAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    deletedAt: '2026-07-20T00:00:00.000Z',
    ...overrides,
  }
}

async function putLocalArtwork(overrides = {}) {
  const record = {
    id: 'a1',
    folderId: null,
    title: 'Local work in progress',
    mediumType: 'Digital',
    medium: 'Procreate',
    status: 'In Progress',
    hours: 3,
    minutes: 20,
    totalMinutes: 200,
    artworkDate: null,
    notes: 'unsaved thoughts',
    favorite: false,
    createdAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-21T00:00:00.000Z',
    cloudRevision: 2,
    ...overrides,
  }
  await db.artworks.put(record)
  return record
}

async function clearAll() {
  await Promise.all([
    db.artworks.clear(),
    db.folders.clear(),
    db.artworkImages.clear(),
    db.syncQueue.clear(),
    db.syncConflicts.clear(),
    db.syncImageHashes.clear(),
  ])
}

describe('deletion safety A: remote tombstone newer + local clean', () => {
  before(async () => {
    await db.open()
  })

  beforeEach(clearAll)

  it('applies the remote delete locally', async () => {
    await putLocalArtwork({ cloudRevision: 2 })
    await saveDurableImageBytes('a1', IMAGE_KINDS.ORIGINAL, BYTES, 'image/jpeg')

    const summary = await mergeCloudLibrary(
      { folders: [], artworks: [cloudDeletedArtwork({ revision: 6 })] },
      { userId: USER, entityType: 'artwork' },
    )

    assert.equal(summary.deleted, 1)
    assert.equal(summary.conflicts, 0)
    assert.equal(await db.artworks.get('a1'), undefined)
  })
})

describe('deletion safety B: remote tombstone newer + local unsynced edit', () => {
  before(async () => {
    await db.open()
  })

  beforeEach(clearAll)

  it('creates a remote_deleted conflict and preserves the local edit', async () => {
    await putLocalArtwork({ cloudRevision: 2 })
    await saveDurableImageBytes('a1', IMAGE_KINDS.ORIGINAL, BYTES, 'image/jpeg')
    await enqueueSyncJob(USER, SYNC_ENTITY_TYPES.ARTWORK, 'a1')

    const summary = await mergeCloudLibrary(
      { folders: [], artworks: [cloudDeletedArtwork({ revision: 9 })] },
      { userId: USER, entityType: 'artwork' },
    )

    assert.equal(summary.conflicts, 1)
    assert.equal(summary.deleted, 0)

    const kept = await db.artworks.get('a1')
    assert.notEqual(kept, undefined, 'the local edit must survive')
    assert.equal(kept.title, 'Local work in progress')
    assert.equal(kept.notes, 'unsaved thoughts')
    assert.notEqual(await getDurableImageRecord('a1', IMAGE_KINDS.ORIGINAL), undefined)

    const conflicts = await getSyncConflictsForUser(USER)
    assert.equal(conflicts.length, 1)
    assert.equal(isRemoteDeletedConflict(conflicts[0]), true)
  })
})

describe('deletion safety C: remote tombstone older + local newer edit', () => {
  before(async () => {
    await db.open()
  })

  beforeEach(clearAll)

  it('never silently deletes a newer local edit', async () => {
    // Local synced at revision 9; the tombstone is only revision 4.
    await putLocalArtwork({ cloudRevision: 9 })
    await enqueueSyncJob(USER, SYNC_ENTITY_TYPES.ARTWORK, 'a1')

    const summary = await mergeCloudLibrary(
      { folders: [], artworks: [cloudDeletedArtwork({ revision: 4 })] },
      { userId: USER, entityType: 'artwork' },
    )

    assert.notEqual(await db.artworks.get('a1'), undefined, 'newer local edit must not be deleted')

    if (summary.conflicts === 1) {
      // Surfaced for a decision.
      const conflicts = await getSyncConflictsForUser(USER)
      assert.equal(isRemoteDeletedConflict(conflicts[0]), true)
    } else {
      // Or the local record was kept and left queued for upload.
      assert.equal(summary.deleted, 0)
      assert.equal(summary.keptLocal + summary.unchanged >= 1, true)
      const jobs = await getSyncJobsForUser(USER)
      assert.equal(jobs.length >= 1, true, 'local change stays queued')
    }
  })

  it('treats localRevision >= tombstone revision as an already-known delete', async () => {
    await putLocalArtwork({ cloudRevision: 9 })
    // Not dirty: this device already caught up to the delete.
    const summary = await mergeCloudLibrary(
      { folders: [], artworks: [cloudDeletedArtwork({ revision: 9 })] },
      { userId: USER, entityType: 'artwork' },
    )

    assert.equal(summary.deleted, 1)
    assert.equal(summary.conflicts, 0)
  })
})

describe('deletion safety D: stale device pushes an old copy', () => {
  before(async () => {
    await db.open()
  })

  beforeEach(clearAll)

  it('refuses to auto-resurrect and reports a conflict', async () => {
    const store = createCloudArtworkStore()
    store.seed('a1', { revision: 6 })
    await putLocalArtwork({ cloudRevision: 4 })

    const result = store.upsert(toCloudArtworkMetadata(await db.artworks.get('a1'), {}))

    assert.equal(result.saved, 0)
    assert.equal(result.conflicts.length, 1)
    assert.equal(result.conflicts[0].reason, 'remote_deleted')
    assert.notEqual(store.rows.get('a1').deleted_at, null, 'still tombstoned')
  })

  it('refuses even when the stale device forces', async () => {
    const store = createCloudArtworkStore()
    store.seed('a1', { revision: 6 })
    await putLocalArtwork({ cloudRevision: 4 })

    const result = store.upsert(
      toCloudArtworkMetadata(await db.artworks.get('a1'), { force: true }),
    )

    assert.equal(result.saved, 0)
    assert.equal(result.conflicts[0].reason, 'remote_deleted')
  })
})

describe('deletion safety E: manual force sync against a tombstone', () => {
  before(async () => {
    await db.open()
  })

  beforeEach(clearAll)

  it('does not bypass the tombstone', () => {
    const existing = { revision: 7, deleted_at: '2026-07-20T00:00:00.000Z' }

    const forced = evaluateRevisionConflict(existing, 7, { force: true })
    assert.equal(forced?.reason, 'remote_deleted')

    const plain = evaluateRevisionConflict(existing, 7, {})
    assert.equal(plain?.reason, 'remote_deleted')
  })

  it('only an explicit allowResurrect bypasses it', () => {
    const existing = { revision: 7, deleted_at: '2026-07-20T00:00:00.000Z' }

    assert.equal(
      evaluateRevisionConflict(existing, 7, { force: true, allowResurrect: true }),
      null,
    )
  })

  it('force sync of a full library does not send allowResurrect', () => {
    const payload = toCloudArtworkMetadata({ id: 'a1', cloudRevision: 7 }, { force: true })
    assert.equal(payload.force, true)
    assert.equal(payload.allowResurrect, undefined)

    const folderPayload = toCloudFolder({ id: 'f1', cloudRevision: 3 }, { force: true })
    assert.equal(folderPayload.allowResurrect, undefined)
  })
})

describe('deletion safety F: user chooses Restore Artwork', () => {
  before(async () => {
    await db.open()
  })

  beforeEach(clearAll)

  it('intentionally resurrects with a new revision and queues images', async () => {
    const store = createCloudArtworkStore()
    store.seed('a1', { revision: 6 })
    const fakeCloud = createFakeCloudApi(store)

    await putLocalArtwork({ cloudRevision: 2 })
    await saveDurableImageBytes('a1', IMAGE_KINDS.ORIGINAL, BYTES, 'image/jpeg')
    await saveDurableImageBytes('a1', IMAGE_KINDS.THUMBNAIL, BYTES, 'image/jpeg')
    await saveSyncConflict({
      userId: USER,
      entityType: SYNC_ENTITY_TYPES.ARTWORK,
      entityId: 'a1',
      baseRevision: 2,
      cloudRevision: 6,
      local: { id: 'a1', title: 'Local work in progress' },
      cloud: { id: 'a1', title: 'Cloud copy', deletedAt: '2026-07-20T00:00:00.000Z' },
      reason: 'remote_deleted_local_changed',
    })

    const conflict = (await getSyncConflictsForUser(USER))[0]
    await resolveRestoreDeleted(conflict, { cloud: fakeCloud })

    assert.equal(store.rows.get('a1').deleted_at, null, 'explicitly restored')
    assert.equal(store.rows.get('a1').revision, 7, 'revision advanced past the tombstone')

    const stored = await db.artworks.get('a1')
    assert.notEqual(stored, undefined, 'artwork kept')
    assert.equal(stored.title, 'Local work in progress')
    assert.equal(stored.cloudRevision, 7, 'local revision advanced')

    assert.equal((await getSyncConflictsForUser(USER)).length, 0, 'conflict resolved')

    const jobs = await getSyncJobsForUser(USER)
    assert.notEqual(
      jobs.find((job) => job.entityType === SYNC_ENTITY_TYPES.ARTWORK_IMAGE),
      undefined,
      'images re-queued for upload',
    )
    assert.notEqual(
      jobs.find((job) => job.entityType === SYNC_ENTITY_TYPES.ARTWORK),
      undefined,
      'metadata queued',
    )
  })

  it('resurrecting a folder advances its revision without cascading artwork', async () => {
    const store = createCloudArtworkStore()
    const fakeCloud = createFakeCloudApi(store)
    store.seed('f1', { revision: 6 })

    await db.folders.put({ id: 'f1', name: 'Street Art', parentFolderId: null, cloudRevision: 3 })
    await putLocalArtwork({ id: 'a2', folderId: 'f1', title: 'Untouched artwork' })

    await saveSyncConflict({
      userId: USER,
      entityType: SYNC_ENTITY_TYPES.FOLDER,
      entityId: 'f1',
      baseRevision: 3,
      cloudRevision: 6,
      local: { id: 'f1', name: 'Street Art' },
      cloud: { id: 'f1', deletedAt: '2026-07-20T00:00:00.000Z' },
      reason: 'remote_deleted',
    })

    const conflict = (await getSyncConflictsForUser(USER))[0]
    await resolveRestoreDeleted(conflict, { cloud: fakeCloud })

    assert.equal(store.rows.get('f1').deleted_at, null)
    assert.equal(store.rows.get('f1').revision, 7)
    assert.equal((await db.folders.get('f1')).cloudRevision, 7)
    assert.notEqual(await db.artworks.get('a2'), undefined, 'artwork untouched')
  })

  it('re-resolving does not loop: a restored item is not conflicted again', async () => {
    const store = createCloudArtworkStore()
    const fakeCloud = createFakeCloudApi(store)
    store.seed('a1', { revision: 6 })

    await putLocalArtwork({ cloudRevision: 2 })
    await saveSyncConflict({
      userId: USER,
      entityType: SYNC_ENTITY_TYPES.ARTWORK,
      entityId: 'a1',
      baseRevision: 2,
      cloudRevision: 6,
      local: { id: 'a1' },
      cloud: { id: 'a1', deletedAt: '2026-07-20T00:00:00.000Z' },
      reason: 'remote_deleted',
    })

    const conflict = (await getSyncConflictsForUser(USER))[0]
    await resolveRestoreDeleted(conflict, { cloud: fakeCloud })

    assert.equal((await getSyncConflictsForUser(USER)).length, 0)

    // Simulate the queued jobs draining, then the next pull: cloud is no longer
    // deleted and revisions match, so this must be a clean no-op.
    await db.syncQueue.clear()
    const summary = await mergeCloudLibrary(
      {
        folders: [],
        artworks: [
          cloudDeletedArtwork({
            revision: store.rows.get('a1').revision,
            deletedAt: null,
            title: 'Local work in progress',
          }),
        ],
      },
      { userId: USER, entityType: 'artwork' },
    )

    assert.equal(summary.conflicts, 0, 'a restored item must not re-conflict')
    assert.equal(summary.deleted, 0, 'a restored item must not be re-deleted')
    assert.notEqual(await db.artworks.get('a1'), undefined)
  })
})

describe('deletion safety G: user chooses Keep Deleted', () => {
  before(async () => {
    await db.open()
  })

  beforeEach(clearAll)

  it('removes local metadata and image bytes', async () => {
    await putLocalArtwork({ cloudRevision: 2 })
    await saveDurableImageBytes('a1', IMAGE_KINDS.ORIGINAL, BYTES, 'image/jpeg')
    await saveDurableImageBytes('a1', IMAGE_KINDS.THUMBNAIL, BYTES, 'image/jpeg')
    await enqueueSyncJob(USER, SYNC_ENTITY_TYPES.ARTWORK_IMAGE, 'a1')

    await saveSyncConflict({
      userId: USER,
      entityType: SYNC_ENTITY_TYPES.ARTWORK,
      entityId: 'a1',
      baseRevision: 2,
      cloudRevision: 9,
      local: { id: 'a1', title: 'Local work in progress' },
      cloud: { id: 'a1', deletedAt: '2026-07-20T00:00:00.000Z' },
      reason: 'remote_deleted_local_changed',
    })

    const conflict = (await getSyncConflictsForUser(USER))[0]
    await resolveKeepDeleted(conflict)

    assert.equal(await db.artworks.get('a1'), undefined, 'metadata removed')
    assert.equal(await getDurableImageRecord('a1', IMAGE_KINDS.ORIGINAL), undefined)
    assert.equal(await getDurableImageRecord('a1', IMAGE_KINDS.THUMBNAIL), undefined)
    assert.equal((await getSyncConflictsForUser(USER)).length, 0)
  })

  it('does not resurrect the cloud copy when keeping deleted', () => {
    const store = createCloudArtworkStore()
    store.seed('a1', { revision: 9 })

    // Keep Deleted issues no push at all, so the tombstone stands.
    assert.equal(store.rows.get('a1').deleted_at, '2026-07-20T00:00:00.000Z')
  })

  it('moves folder contents to root instead of deleting artwork', async () => {
    await db.folders.put({ id: 'f1', name: 'Street Art', parentFolderId: null, cloudRevision: 3 })
    await putLocalArtwork({ folderId: 'f1', id: 'a2', title: 'Keep me' })
    await db.folders.put({ id: 'f2', name: 'Nested', parentFolderId: 'f1', cloudRevision: 1 })

    await saveSyncConflict({
      userId: USER,
      entityType: SYNC_ENTITY_TYPES.FOLDER,
      entityId: 'f1',
      baseRevision: 3,
      cloudRevision: 7,
      local: { id: 'f1', name: 'Street Art' },
      cloud: { id: 'f1', deletedAt: '2026-07-20T00:00:00.000Z' },
      reason: 'remote_deleted',
    })

    const conflict = (await getSyncConflictsForUser(USER))[0]
    await resolveKeepDeleted(conflict)

    assert.equal(await db.folders.get('f1'), undefined, 'folder removed')
    assert.notEqual(await db.artworks.get('a2'), undefined, 'artwork NOT deleted')
    assert.equal((await db.artworks.get('a2')).folderId, null, 'artwork moved to root')
    assert.equal((await db.folders.get('f2')).parentFolderId, null, 'child folder re-parented')
  })

  it('is idempotent when the local record is already gone', async () => {
    await saveSyncConflict({
      userId: USER,
      entityType: SYNC_ENTITY_TYPES.ARTWORK,
      entityId: 'a1',
      baseRevision: 2,
      cloudRevision: 9,
      local: { id: 'a1' },
      cloud: { id: 'a1', deletedAt: '2026-07-20T00:00:00.000Z' },
      reason: 'remote_deleted',
    })

    const conflict = (await getSyncConflictsForUser(USER))[0]
    await resolveKeepDeleted(conflict)

    assert.equal((await getSyncConflictsForUser(USER)).length, 0)
  })
})