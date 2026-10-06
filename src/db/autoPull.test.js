import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { before, beforeEach, describe, it } from 'node:test'
import { extensionlessResolveHooks } from '../testResolveHook.mjs'

registerHooks(extensionlessResolveHooks)
await import('fake-indexeddb/auto')

const { db } = await import('./database.js')
const { IMAGE_KINDS } = await import('./artworkImageKeys.js')
const { hasStoredImageBytes, saveDurableImageBytes } = await import('./artworkImageStorage.js')
const { enqueueSyncJob } = await import('./syncQueueService.js')
const { getSyncConflictsForUser } = await import('./syncConflictService.js')
const { pullAndMerge } = await import('../sync/autoPull.js')
const { SYNC_ENTITY_TYPES } = await import('../sync/constants.js')

const USER = 'user-pull'
const BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0x01, 0x02, 0x03, 0x04])
const THUMB = new Uint8Array([0xff, 0xd8, 0xff, 0x0a, 0x0b])

function cloudArtwork(overrides = {}) {
  return {
    id: 'a1',
    folderId: null,
    title: 'From cloud',
    mediumType: 'Digital',
    medium: 'Procreate',
    status: 'Finished',
    hours: 2,
    minutes: 0,
    totalMinutes: 120,
    artworkDate: null,
    notes: '',
    favorite: false,
    revision: 4,
    hasOriginal: true,
    hasThumbnail: true,
    createdAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  }
}

/** Records every download so we can assert nothing repeats. */
function trackingDeps(library, { failFor = [] } = {}) {
  const downloaded = []
  return {
    downloaded,
    deps: {
      fetchLibrary: async (options) => {
        // The pull must ask for tombstones, otherwise deletions never arrive.
        assert.equal(options?.includeDeleted, true, 'must request tombstones')
        return library
      },
      downloadImage: async (artworkId, type) => {
        if (failFor.includes(`${artworkId}:${type}`)) {
          throw new Error('simulated download failure')
        }
        downloaded.push(`${artworkId}:${type}`)
        return new Blob([BYTES], { type: 'image/jpeg' })
      },
      // Bypass canvas normalization; we are testing orchestration, not imaging.
      saveImage: async (artworkId, type) => {
        await saveDurableImageBytes(
          artworkId,
          type === 'thumbnail' ? IMAGE_KINDS.THUMBNAIL : IMAGE_KINDS.ORIGINAL,
          type === 'thumbnail' ? THUMB : BYTES,
          'image/jpeg',
        )
      },
    },
  }
}

describe('autoPull: metadata', () => {
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

  it('pulls remote artwork and folder into a fresh device', async () => {
    const library = {
      folders: [
        {
          id: 'f1',
          name: 'Traditional',
          parentFolderId: null,
          revision: 2,
          createdAt: '2026-07-18T00:00:00.000Z',
          updatedAt: '2026-07-20T00:00:00.000Z',
          deletedAt: null,
        },
      ],
      artworks: [cloudArtwork({ folderId: 'f1' })],
    }
    const { deps } = trackingDeps(library)

    const result = await pullAndMerge({ userId: USER, deps })

    assert.equal(result.changed, true)
    assert.equal((await db.artworks.get('a1')).title, 'From cloud')
    assert.equal((await db.folders.get('f1')).name, 'Traditional')
  })

  // 8. focus -> newer remote data pulled
  it('pulls newer remote data on a later pass', async () => {
    const first = trackingDeps({ folders: [], artworks: [cloudArtwork({ revision: 4 })] })
    await pullAndMerge({ userId: USER, deps: first.deps })
    assert.equal((await db.artworks.get('a1')).title, 'From cloud')

    // Another device edits it.
    const second = trackingDeps({
      folders: [],
      artworks: [cloudArtwork({ revision: 9, title: 'Edited on phone' })],
    })
    await pullAndMerge({ userId: USER, deps: second.deps })

    assert.equal((await db.artworks.get('a1')).title, 'Edited on phone')
    assert.equal((await db.artworks.get('a1')).cloudRevision, 9)
  })

  // 7. offline creation -> reconnect -> sync
  it('does not clobber a local edit made before the pull', async () => {
    await db.artworks.put({
      id: 'a1',
      folderId: null,
      title: 'Edited offline',
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
      updatedAt: '2026-07-21T00:00:00.000Z',
      cloudRevision: 1,
    })
    await enqueueSyncJob(USER, SYNC_ENTITY_TYPES.ARTWORK, 'a1')

    const { deps } = trackingDeps({
      folders: [],
      artworks: [cloudArtwork({ revision: 8, title: 'Cloud version' })],
    })
    const result = await pullAndMerge({ userId: USER, deps })

    assert.equal(result.artworks.conflicts, 1)
    assert.equal((await db.artworks.get('a1')).title, 'Edited offline')
    assert.equal((await getSyncConflictsForUser(USER)).length, 1)
  })

  it('applies a remote deletion to a clean local record', async () => {
    await db.artworks.put({
      id: 'a1',
      folderId: null,
      title: 'Doomed',
      mediumType: 'Digital',
      medium: '',
      status: 'Finished',
      hours: 0,
      minutes: 0,
      totalMinutes: 0,
      artworkDate: null,
      notes: '',
      favorite: false,
      createdAt: '2026-07-18T00:00:00.000Z',
      updatedAt: '2026-07-18T00:00:00.000Z',
      cloudRevision: 2,
    })

    const { deps } = trackingDeps({
      folders: [],
      artworks: [cloudArtwork({ revision: 6, deletedAt: '2026-07-22T00:00:00.000Z' })],
    })
    const result = await pullAndMerge({ userId: USER, deps })

    assert.equal(result.changed, true)
    assert.equal(await db.artworks.get('a1'), undefined)
  })

  it('reports unchanged when there is nothing to do', async () => {
    await db.artworks.put({
      id: 'a1',
      folderId: null,
      title: 'Already current',
      mediumType: 'Digital',
      medium: '',
      status: 'Finished',
      hours: 0,
      minutes: 0,
      totalMinutes: 0,
      artworkDate: null,
      notes: '',
      favorite: false,
      createdAt: '2026-07-18T00:00:00.000Z',
      updatedAt: '2026-07-20T00:00:00.000Z',
      cloudRevision: 4,
    })
    await saveDurableImageBytes('a1', IMAGE_KINDS.ORIGINAL, BYTES, 'image/jpeg')
    await saveDurableImageBytes('a1', IMAGE_KINDS.THUMBNAIL, THUMB, 'image/jpeg')

    const { deps, downloaded } = trackingDeps({ folders: [], artworks: [cloudArtwork()] })
    const result = await pullAndMerge({ userId: USER, deps })

    assert.equal(result.changed, false)
    assert.equal(downloaded.length, 0, 'must not re-download identical images')
  })
})

describe('autoPull: image reconciliation', () => {
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

  // 5. remote image -> local download
  it('downloads images this device does not have', async () => {
    const { deps, downloaded } = trackingDeps({ folders: [], artworks: [cloudArtwork()] })

    const result = await pullAndMerge({ userId: USER, deps })

    assert.equal(result.downloaded, 2)
    assert.deepEqual(downloaded.sort(), ['a1:original', 'a1:thumbnail'])
    assert.equal(await hasStoredImageBytes('a1', IMAGE_KINDS.ORIGINAL), true)
    assert.equal(await hasStoredImageBytes('a1', IMAGE_KINDS.THUMBNAIL), true)
  })

  // 17. identical image is not repeatedly downloaded
  it('does not re-download images already stored locally', async () => {
    const { deps, downloaded } = trackingDeps({ folders: [], artworks: [cloudArtwork()] })
    await pullAndMerge({ userId: USER, deps })
    assert.equal(downloaded.length, 2)

    const second = trackingDeps({ folders: [], artworks: [cloudArtwork({ revision: 5 })] })
    const result = await pullAndMerge({ userId: USER, deps: second.deps })

    assert.equal(second.downloaded.length, 0)
    assert.equal(result.downloaded, 0)
  })

  it('downloads only the kind that is missing', async () => {
    await db.artworks.put({
      id: 'a1',
      folderId: null,
      title: 'Has original',
      mediumType: 'Digital',
      medium: '',
      status: 'Finished',
      hours: 0,
      minutes: 0,
      totalMinutes: 0,
      artworkDate: null,
      notes: '',
      favorite: false,
      createdAt: '2026-07-18T00:00:00.000Z',
      updatedAt: '2026-07-18T00:00:00.000Z',
      cloudRevision: 4,
    })
    await saveDurableImageBytes('a1', IMAGE_KINDS.ORIGINAL, BYTES, 'image/jpeg')

    const { deps, downloaded } = trackingDeps({ folders: [], artworks: [cloudArtwork()] })
    const result = await pullAndMerge({ userId: USER, deps })

    assert.equal(result.downloaded, 1)
    assert.deepEqual(downloaded, ['a1:thumbnail'])
  })

  it('keeps metadata and local bytes when a download fails', async () => {
    const { deps } = trackingDeps(
      { folders: [], artworks: [cloudArtwork()] },
      { failFor: ['a1:original'] },
    )

    const result = await pullAndMerge({ userId: USER, deps })

    assert.equal(result.downloaded, 1, 'thumbnail still downloads')
    assert.equal(result.downloadFailures, 1)
    assert.notEqual(await db.artworks.get('a1'), undefined, 'metadata merge must survive')
    assert.equal(await hasStoredImageBytes('a1', IMAGE_KINDS.THUMBNAIL), true)
  })

  // 16. successful image upload preserves local bytes
  it('preserves existing local bytes across a pull that downloads nothing new', async () => {
    await db.artworks.put({
      id: 'a1',
      folderId: null,
      title: 'Local',
      mediumType: 'Digital',
      medium: '',
      status: 'Finished',
      hours: 0,
      minutes: 0,
      totalMinutes: 0,
      artworkDate: null,
      notes: '',
      favorite: false,
      createdAt: '2026-07-18T00:00:00.000Z',
      updatedAt: '2026-07-18T00:00:00.000Z',
      cloudRevision: 4,
    })
    await saveDurableImageBytes('a1', IMAGE_KINDS.ORIGINAL, BYTES, 'image/jpeg')
    await saveDurableImageBytes('a1', IMAGE_KINDS.THUMBNAIL, THUMB, 'image/jpeg')

    const { deps } = trackingDeps({
      folders: [],
      artworks: [cloudArtwork({ revision: 6, title: 'Cloud update' })],
    })
    await pullAndMerge({ userId: USER, deps })

    assert.equal(await hasStoredImageBytes('a1', IMAGE_KINDS.ORIGINAL), true)
    assert.equal(await hasStoredImageBytes('a1', IMAGE_KINDS.THUMBNAIL), true)
  })

  // 6. local image -> R2 upload (queued by the reconcile step)
  it('queues an upload when the cloud has no image for a local image', async () => {
    await db.artworks.put({
      id: 'a1',
      folderId: null,
      title: 'Local only',
      mediumType: 'Digital',
      medium: '',
      status: 'Finished',
      hours: 0,
      minutes: 0,
      totalMinutes: 0,
      artworkDate: null,
      notes: '',
      favorite: false,
      createdAt: '2026-07-18T00:00:00.000Z',
      updatedAt: '2026-07-18T00:00:00.000Z',
      cloudRevision: 4,
    })
    await saveDurableImageBytes('a1', IMAGE_KINDS.ORIGINAL, BYTES, 'image/jpeg')
    await saveDurableImageBytes('a1', IMAGE_KINDS.THUMBNAIL, THUMB, 'image/jpeg')

    const { deps } = trackingDeps({
      folders: [],
      artworks: [cloudArtwork({ hasOriginal: false, hasThumbnail: false })],
    })
    await pullAndMerge({ userId: USER, deps })

    const { getSyncJobsForUser } = await import('./syncQueueService.js')
    const jobs = await getSyncJobsForUser(USER)
    const imageJobs = jobs.filter((job) => job.entityType === SYNC_ENTITY_TYPES.ARTWORK_IMAGE)

    assert.equal(imageJobs.length, 1, 'expected the image upload to be requeued')
    assert.equal(imageJobs[0].entityId, 'a1')
  })
})

describe('autoPull: signed-out safety', () => {
  before(async () => {
    await db.open()
  })

  beforeEach(async () => {
    await Promise.all([db.artworks.clear(), db.folders.clear(), db.syncQueue.clear()])
  })

  // 18. logged-out user does not call protected cloud endpoints
  it('never fetches without a userId', async () => {
    let called = false
    const result = await pullAndMerge({
      userId: null,
      deps: {
        fetchLibrary: async () => {
          called = true
          return { folders: [], artworks: [] }
        },
      },
    })

    assert.equal(called, false, 'must not hit protected endpoints when signed out')
    assert.equal(result.changed, false)
  })
})