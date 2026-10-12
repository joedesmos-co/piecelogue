import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { before, beforeEach, describe, it } from 'node:test'
import { extensionlessResolveHooks } from '../testResolveHook.mjs'

registerHooks(extensionlessResolveHooks)

await import('fake-indexeddb/auto')

const { db } = await import('./database.js')
const { IMAGE_KINDS } = await import('./artworkImageKeys.js')
const {
  deleteOrphanRecoveryImageRecords,
  getDurableImageRecord,
  markImageRecoveryRequired,
  saveDurableImageBytes,
} = await import('./artworkImageStorage.js')
const {
  getArtworksNeedingImageRecovery,
  getRecoveryRequiredArtworksWithTitles,
} = await import('./imageRepair.js')
const { reconcileIncompleteCloudImages } = await import(
  '../sync/reconcileIncompleteCloudImages.js'
)
const { mergeRepairEntries } = await import('../utils/repairEntries.js')

const ORIGINAL_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0x01, 0x02, 0x03, 0x04, 0x05])
const THUMBNAIL_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xaa, 0xbb, 0xcc])

const CLOUD_ROW = (artwork) => ({
  id: artwork.id,
  title: artwork.title,
  folderId: null,
  mediumType: artwork.mediumType ?? 'Digital',
  medium: '',
  status: 'In Progress',
  hours: 1,
  minutes: 0,
  totalMinutes: 60,
  revision: 2,
  hasOriginal: false,
  hasThumbnail: false,
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
  deletedAt: null,
})

async function addLocalArtwork(id, title = 'Study') {
  await db.artworks.add({
    id,
    title,
    mediumType: 'Digital',
    medium: '',
    status: 'In Progress',
    hours: 1,
    minutes: 0,
    totalMinutes: 60,
    durationUnknown: false,
    notes: '',
    favorite: false,
    folderId: null,
    createdAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-18T00:00:00.000Z',
  })
}

/**
 * The exact sequence autoPull runs: a tombstone-inclusive library is fetched,
 * deletes are applied locally, and the same snapshot is handed to reconcile.
 */
async function reconcileWithLibrary(userId, artworks) {
  await reconcileIncompleteCloudImages(userId, {
    force: true,
    fetchLibrary: async () => ({ folders: [], artworks }),
  })
}

describe('image repair entries only describe live local artwork', () => {
  before(async () => {
    await db.open()
  })

  beforeEach(async () => {
    await db.artworkImages.clear()
    await db.artworks.clear()
    await db.syncQueue.clear()
    await db.syncImageHashes.clear()
  })

  it('reports one entry for a live artwork with a real title', async () => {
    await addLocalArtwork('damaged-1', 'Still Life With Pear')

    await reconcileWithLibrary('u', [CLOUD_ROW({ id: 'damaged-1', title: 'Still Life With Pear' })])

    const entries = await getRecoveryRequiredArtworksWithTitles()
    assert.equal(entries.length, 1)
    assert.equal(entries[0].artworkId, 'damaged-1')
    assert.equal(entries[0].title, 'Still Life With Pear')
  })

  it('uses "Untitled artwork" only when the live artwork truly has no title', async () => {
    await addLocalArtwork('damaged-2', '')

    await reconcileWithLibrary('u', [CLOUD_ROW({ id: 'damaged-2', title: 'Cloud Title' })])

    const entries = await getRecoveryRequiredArtworksWithTitles()
    assert.equal(entries.length, 1)
    assert.equal(entries[0].title, 'Untitled artwork')
  })

  it('collapses a damaged original and thumbnail into ONE artwork-level entry', async () => {
    await addLocalArtwork('damaged-both', 'Double Damage')

    await reconcileWithLibrary('u', [CLOUD_ROW({ id: 'damaged-both', title: 'Double Damage' })])

    // Both kinds were flagged...
    const original = await getDurableImageRecord('damaged-both', IMAGE_KINDS.ORIGINAL)
    const thumbnail = await getDurableImageRecord('damaged-both', IMAGE_KINDS.THUMBNAIL)
    assert.equal(original.recoveryRequired, true)
    assert.equal(thumbnail.recoveryRequired, true)

    // ...but the user sees one entry.
    const entries = await getRecoveryRequiredArtworksWithTitles()
    assert.equal(entries.length, 1)
    assert.deepEqual([...entries[0].kinds].sort(), ['original', 'thumbnail'])
  })

  it('never creates an orphan durable record for a cloud tombstone', async () => {
    await addLocalArtwork('live-1', 'Alive')

    // The pull library carries a deleted row whose R2 images were also removed.
    await reconcileWithLibrary('u', [
      CLOUD_ROW({ id: 'live-1', title: 'Alive' }),
      {...CLOUD_ROW({ id: 'tomb-1', title: 'Conflict One iqbh' }),
        deletedAt: '2026-10-06T02:39:06.159Z'},
    ])

    const entries = await getRecoveryRequiredArtworksWithTitles()
    assert.deepEqual(entries.map((entry) => entry.artworkId), ['live-1'])

    const tombOriginal = await getDurableImageRecord('tomb-1', IMAGE_KINDS.ORIGINAL)
    assert.equal(tombOriginal?.recoveryRequired, undefined, 'tombstone must not be flagged')
  })

  it('reports nothing for artwork deleted locally', async () => {
    // Local row exists, then is removed while the cloud row still reports it.
    await addLocalArtwork('deleted-1', 'Gone')

    await reconcileWithLibrary('u', [CLOUD_ROW({ id: 'deleted-1', title: 'Gone' })])
    assert.equal((await getRecoveryRequiredArtworksWithTitles()).length, 1)

    // deleteArtwork() removes the row and the durable images together.
    await db.artworks.delete('deleted-1')

    assert.deepEqual(await getRecoveryRequiredArtworksWithTitles(), [])
  })

  it('clears a pre-existing orphan recovery row', async () => {
    await addLocalArtwork('live-2', 'Alive')
    await markImageRecoveryRequired('orphan-ghost', IMAGE_KINDS.ORIGINAL, 'cloud_incomplete')
    await markImageRecoveryRequired('orphan-ghost', IMAGE_KINDS.THUMBNAIL, 'cloud_incomplete')

    const removed = await deleteOrphanRecoveryImageRecords()
    assert.equal(removed, 2)

    assert.deepEqual(await getArtworksNeedingImageRecovery(), [])
    assert.equal(await getDurableImageRecord('orphan-ghost', IMAGE_KINDS.ORIGINAL), undefined)
  })

  it('keeps unflagged rows that a concurrent create just wrote', async () => {
    // createArtwork persists durable bytes before the artwork row exists.
    await saveDurableImageBytes('creating-1', IMAGE_KINDS.ORIGINAL, ORIGINAL_BYTES, 'image/jpeg')

    assert.equal(await deleteOrphanRecoveryImageRecords(), 0)
    const survivor = await getDurableImageRecord('creating-1', IMAGE_KINDS.ORIGINAL)
    assert.equal(survivor.byteLength, ORIGINAL_BYTES.byteLength)
  })

  it('removes the repair entry once the artwork is repaired', async () => {
    await addLocalArtwork('repair-1', 'Repair Me')

    await reconcileWithLibrary('u', [CLOUD_ROW({ id: 'repair-1', title: 'Repair Me' })])
    assert.equal((await getRecoveryRequiredArtworksWithTitles()).length, 1)

    // repairArtworkImage() rewrites source, original and thumbnail unflagged.
    await saveDurableImageBytes('repair-1', IMAGE_KINDS.SOURCE, ORIGINAL_BYTES, 'image/jpeg', {
      origin: 'local',
    })
    await saveDurableImageBytes('repair-1', IMAGE_KINDS.ORIGINAL, ORIGINAL_BYTES, 'image/jpeg', {
      origin: 'local',
    })
    await saveDurableImageBytes('repair-1', IMAGE_KINDS.THUMBNAIL, THUMBNAIL_BYTES, 'image/jpeg', {
      origin: 'local',
    })

    assert.deepEqual(await getRecoveryRequiredArtworksWithTitles(), [])
  })

  it('re-queues the upload instead of warning when local bytes still exist', async () => {
    await addLocalArtwork('intact-1', 'Intact')
    await saveDurableImageBytes('intact-1', IMAGE_KINDS.ORIGINAL, ORIGINAL_BYTES, 'image/jpeg')
    await saveDurableImageBytes('intact-1', IMAGE_KINDS.THUMBNAIL, THUMBNAIL_BYTES, 'image/jpeg')

    await reconcileWithLibrary('u', [CLOUD_ROW({ id: 'intact-1', title: 'Intact' })])

    assert.deepEqual(await getRecoveryRequiredArtworksWithTitles(), [])
  })
})

describe('repair entry merging', () => {
  it('shows one entry when both sources flag the same artwork', () => {
    const local = [
      { artworkId: 'a', kinds: ['original', 'thumbnail'], reasons: ['cloud_incomplete'] },
    ]
    const cloud = [{ artworkId: 'a', title: 'Same Piece', reasons: ['cloud_incomplete'] }]

    const merged = mergeRepairEntries(local, cloud)
    assert.equal(merged.length, 1)
    assert.equal(merged[0].artworkId, 'a')
    assert.deepEqual(merged[0].reasons, ['cloud_incomplete'])
  })

  it('keeps distinct artworks separate', () => {
    const merged = mergeRepairEntries(
      [{ artworkId: 'a', title: 'A', reasons: ['cloud_incomplete'] }],
      [{ artworkId: 'b', title: 'B', reasons: ['cloud_incomplete'] }],
    )
    assert.deepEqual(merged.map((entry) => entry.artworkId), ['a', 'b'])
  })

  it('ignores entries with no artwork id', () => {
    const merged = mergeRepairEntries([null, { title: 'broken', reasons: [] }])
    assert.equal(merged.length, 0)
  })
})
