import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { before, beforeEach, describe, it } from 'node:test'
import { extensionlessResolveHooks } from '../testResolveHook.mjs'

registerHooks(extensionlessResolveHooks)
await import('fake-indexeddb/auto')

const { db } = await import('./database.js')
const { IMAGE_KINDS } = await import('./artworkImageKeys.js')
const {
  getDurableImageRecord,
  hasStoredImageBytes,
  markImageRecoveryRequired,
  saveDurableImageBytes,
} = await import('./artworkImageStorage.js')
const { getSyncJobsForUser, enqueueSyncJob } = await import('./syncQueueService.js')
const { getSyncConflictsForUser } = await import('./syncConflictService.js')
const { mergeCloudLibrary } = await import('./mergeService.js')
const { SYNC_ENTITY_TYPES } = await import('../sync/constants.js')

const USER = 'user-auto'
const BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0x11, 0x22, 0x33])

function cloudArtwork(overrides = {}) {
  return {
    id: 'a1',
    folderId: null,
    title: 'Cloud title',
    mediumType: 'Digital',
    medium: 'Procreate',
    status: 'Finished',
    hours: 1,
    minutes: 30,
    totalMinutes: 90,
    artworkDate: null,
    notes: '',
    favorite: false,
    revision: 3,
    hasOriginal: true,
    hasThumbnail: true,
    createdAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-19T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  }
}

function cloudFolder(overrides = {}) {
  return {
    id: 'f1',
    name: 'Traditional',
    parentFolderId: null,
    revision: 2,
    createdAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-19T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  }
}

async function putLocalArtwork(overrides = {}) {
  const record = {
    id: 'a1',
    folderId: null,
    title: 'Local title',
    mediumType: 'Digital',
    medium: 'Procreate',
    status: 'In Progress',
    hours: 0,
    minutes: 0,
    totalMinutes: 0,
    artworkDate: null,
    notes: '',
    favorite: false,
    createdAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-18T12:00:00.000Z',
    cloudRevision: 3,
    ...overrides,
  }
  await db.artworks.put(record)
  return record
}

describe('mergeService: remote -> local', () => {
  before(async () => {
    await db.open()
  })

  beforeEach(async () => {
    await Promise.all([
      db.artworks.clear(),
      db.folders.clear(),
      db.artworkImages.clear(),
      db.syncQueue.clear(),
      db.syncConflicts.clear(),
      db.syncImageHashes.clear(),
    ])
  })

  // 3. remote artwork -> local pull
  it('imports a remote-only artwork', async () => {
    const summary = await mergeCloudLibrary(
      { folders: [], artworks: [cloudArtwork()] },
      { userId: USER, entityType: 'artwork' },
    )

    const stored = await db.artworks.get('a1')
    assert.equal(summary.imported, 1)
    assert.equal(stored.title, 'Cloud title')
    assert.equal(stored.status, 'Finished')
    assert.equal(stored.cloudRevision, 3)
  })

  // 4. remote folder -> local pull
  it('imports a remote-only folder', async () => {
    const summary = await mergeCloudLibrary(
      { folders: [cloudFolder()], artworks: [] },
      { userId: USER, entityType: 'folder' },
    )

    const stored = await db.folders.get('f1')
    assert.equal(summary.imported, 1)
    assert.equal(stored.name, 'Traditional')
    assert.equal(stored.cloudRevision, 2)
  })

  // 9. same revision -> no unnecessary write
  it('does not rewrite an artwork at the same revision', async () => {
    await putLocalArtwork({ cloudRevision: 3 })

    const summary = await mergeCloudLibrary(
      { folders: [], artworks: [cloudArtwork({ revision: 3 })] },
      { userId: USER, entityType: 'artwork' },
    )

    assert.equal(summary.unchanged, 1)
    assert.equal(summary.applied, 0)
    assert.equal((await db.artworks.get('a1')).title, 'Local title')
  })

  // 10. cloud newer -> local updated
  it('applies a strictly newer remote artwork', async () => {
    await putLocalArtwork({ cloudRevision: 1 })

    const summary = await mergeCloudLibrary(
      { folders: [], artworks: [cloudArtwork({ revision: 5, title: 'Newer cloud' })] },
      { userId: USER, entityType: 'artwork' },
    )

    const stored = await db.artworks.get('a1')
    assert.equal(summary.applied, 1)
    assert.equal(stored.title, 'Newer cloud')
    assert.equal(stored.cloudRevision, 5)
  })

  // 11. local newer -> kept, not overwritten
  it('keeps a local record whose revision is ahead of the cloud', async () => {
    await putLocalArtwork({ cloudRevision: 9 })

    const summary = await mergeCloudLibrary(
      { folders: [], artworks: [cloudArtwork({ revision: 2, title: 'Older cloud' })] },
      { userId: USER, entityType: 'artwork' },
    )

    assert.equal(summary.keptLocal, 1)
    assert.equal((await db.artworks.get('a1')).title, 'Local title')
  })

  // 12. true conflict -> syncConflicts entry, local untouched
  it('records a conflict when both sides changed', async () => {
    await putLocalArtwork({ cloudRevision: 2 })
    await enqueueSyncJob(USER, SYNC_ENTITY_TYPES.ARTWORK, 'a1')

    const summary = await mergeCloudLibrary(
      { folders: [], artworks: [cloudArtwork({ revision: 8, title: 'Cloud edit' })] },
      { userId: USER, entityType: 'artwork' },
    )

    assert.equal(summary.conflicts, 1)
    assert.equal((await db.artworks.get('a1')).title, 'Local title')

    const conflicts = await getSyncConflictsForUser(USER)
    assert.equal(conflicts.length, 1)
    assert.equal(conflicts[0].entityId, 'a1')
    assert.equal(conflicts[0].local.title, 'Local title')
    assert.equal(conflicts[0].cloud.title, 'Cloud edit')
  })

  // 13. remote deletion -> local deletion
  it('applies a remote tombstone to a clean local artwork', async () => {
    await putLocalArtwork({ cloudRevision: 2 })

    const summary = await mergeCloudLibrary(
      {
        folders: [],
        artworks: [cloudArtwork({ revision: 4, deletedAt: '2026-07-20T00:00:00.000Z' })],
      },
      { userId: USER, entityType: 'artwork' },
    )

    assert.equal(summary.deleted, 1)
    assert.equal(await db.artworks.get('a1'), undefined)
  })

  // 14. no deleted-item resurrection
  it('refuses to resurrect a tombstoned artwork when local has unsynced edits', async () => {
    await putLocalArtwork({ cloudRevision: 1 })
    await enqueueSyncJob(USER, SYNC_ENTITY_TYPES.ARTWORK, 'a1')

    const summary = await mergeCloudLibrary(
      {
        folders: [],
        artworks: [cloudArtwork({ revision: 9, deletedAt: '2026-07-20T00:00:00.000Z' })],
      },
      { userId: USER, entityType: 'artwork' },
    )

    assert.equal(summary.conflicts, 1)
    assert.equal(summary.deleted, 0)
    assert.notEqual(await db.artworks.get('a1'), undefined, 'local work must survive')
  })

  it('applies a remote tombstone to a folder and leaves artwork links intact', async () => {
    await db.folders.put({ id: 'f1', name: 'Traditional', parentFolderId: null, cloudRevision: 1 })
    await putLocalArtwork({ folderId: 'f1', cloudRevision: 1 })

    const summary = await mergeCloudLibrary(
      { folders: [cloudFolder({ revision: 5, deletedAt: '2026-07-20T00:00:00.000Z' })], artworks: [] },
      { userId: USER, entityType: 'folder' },
    )

    assert.equal(summary.deleted, 1)
    assert.equal(await db.folders.get('f1'), undefined)
    assert.notEqual(await db.artworks.get('a1'), undefined, 'artwork must not be deleted with folder')
  })

  it('does not import a tombstoned remote-only entity', async () => {
    const summary = await mergeCloudLibrary(
      { folders: [], artworks: [cloudArtwork({ id: 'ghost', deletedAt: '2026-07-20T00:00:00.000Z' })] },
      { userId: USER, entityType: 'artwork' },
    )

    assert.equal(summary.imported, 0)
    assert.equal(await db.artworks.get('ghost'), undefined)
  })
})

describe('mergeService: images and byte safety', () => {
  before(async () => {
    await db.open()
  })

  beforeEach(async () => {
    await Promise.all([
      db.artworks.clear(),
      db.folders.clear(),
      db.artworkImages.clear(),
      db.syncQueue.clear(),
      db.syncConflicts.clear(),
    ])
  })

  // 16. successful upload preserves local bytes
  it('does not touch local image bytes when applying newer metadata', async () => {
    await putLocalArtwork({ cloudRevision: 1 })
    await saveDurableImageBytes('a1', IMAGE_KINDS.ORIGINAL, BYTES, 'image/jpeg')

    await mergeCloudLibrary(
      { folders: [], artworks: [cloudArtwork({ revision: 6 })] },
      { userId: USER, entityType: 'artwork' },
    )

    const record = await getDurableImageRecord('a1', IMAGE_KINDS.ORIGINAL)
    assert.equal(record.byteLength, BYTES.byteLength)
    assert.deepEqual(Array.from(new Uint8Array(record.data)), Array.from(BYTES))
  })

  it('removes image bytes only when another device deleted the artwork', async () => {
    await putLocalArtwork({ cloudRevision: 2 })
    await saveDurableImageBytes('a1', IMAGE_KINDS.ORIGINAL, BYTES, 'image/jpeg')

    await mergeCloudLibrary(
      { folders: [], artworks: [cloudArtwork({ revision: 4, deletedAt: '2026-07-20T00:00:00.000Z' })] },
      { userId: USER, entityType: 'artwork' },
    )

    assert.equal(await hasStoredImageBytes('a1', IMAGE_KINDS.ORIGINAL), false)
  })

  it('keeps flagged-but-intact bytes after a metadata merge', async () => {
    await putLocalArtwork({ cloudRevision: 1 })
    await saveDurableImageBytes('a1', IMAGE_KINDS.THUMBNAIL, BYTES, 'image/jpeg')
    await markImageRecoveryRequired('a1', IMAGE_KINDS.THUMBNAIL, 'unreadable_blob')

    await mergeCloudLibrary(
      { folders: [], artworks: [cloudArtwork({ revision: 7 })] },
      { userId: USER, entityType: 'artwork' },
    )

    const record = await getDurableImageRecord('a1', IMAGE_KINDS.THUMBNAIL)
    assert.equal(record.byteLength, BYTES.byteLength, 'merge must not clear healthy bytes')
  })
})

describe('mergeService: queue interactions', () => {
  before(async () => {
    await db.open()
  })

  beforeEach(async () => {
    await Promise.all([
      db.artworks.clear(),
      db.folders.clear(),
      db.artworkImages.clear(),
      db.syncQueue.clear(),
      db.syncConflicts.clear(),
    ])
  })

  it('does not treat an image job as metadata-dirty metadata', async () => {
    await putLocalArtwork({ cloudRevision: 1 })
    await enqueueSyncJob(USER, SYNC_ENTITY_TYPES.ARTWORK_IMAGE, 'a1')

    const summary = await mergeCloudLibrary(
      { folders: [], artworks: [cloudArtwork({ revision: 9 })] },
      { userId: USER, entityType: 'artwork' },
    )

    // A pending image upload is still local work, so a divergent remote edit
    // must not silently clobber the local record.
    assert.equal(summary.conflicts, 1)
  })

  it('leaves pending jobs in place so uploads still happen', async () => {
    await putLocalArtwork({ cloudRevision: 1 })
    await enqueueSyncJob(USER, SYNC_ENTITY_TYPES.ARTWORK_IMAGE, 'a1')

    await mergeCloudLibrary(
      { folders: [], artworks: [cloudArtwork({ revision: 1 })] },
      { userId: USER, entityType: 'artwork' },
    )

    const jobs = await getSyncJobsForUser(USER)
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].entityType, SYNC_ENTITY_TYPES.ARTWORK_IMAGE)
  })
})