import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { before, beforeEach, describe, it } from 'node:test'
import { extensionlessResolveHooks } from '../testResolveHook.mjs'

// The app is bundled by Vite and uses extensionless relative imports, which
// Node's ESM loader rejects. Register the resolver before importing app modules.
registerHooks(extensionlessResolveHooks)

await import('fake-indexeddb/auto')

const { db } = await import('./database.js')
const { IMAGE_KINDS } = await import('./artworkImageKeys.js')
const {
  clearImageRecoveryRequired,
  getDurableImageRecord,
  hasStoredImageBytes,
  hasVerifiedDurableImage,
  markImageRecoveryRequired,
  saveDurableImageBytes,
} = await import('./artworkImageStorage.js')
const { resolveArtworkImageForSync } = await import('./imageRepair.js')
const { reconcileIncompleteCloudImages } = await import(
  '../sync/reconcileIncompleteCloudImages.js'
)
const { getSyncJobsForUser } = await import('./syncQueueService.js')

const ORIGINAL_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0x01, 0x02, 0x03, 0x04, 0x05])
const THUMBNAIL_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xaa, 0xbb, 0xcc])

// A cloud library that reports nothing, so no cloud repair can mask a local result.
const emptyCloudLibrary = async () => ({ folders: [], artworks: [] })

function artworkWithoutImages(id) {
  return {
    id,
    title: 'Study',
    mediumType: 'Digital',
    status: 'In Progress',
    createdAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-18T00:00:00.000Z',
  }
}

describe('resolveArtworkImageForSync durable read', () => {
  before(async () => {
    await db.open()
  })

  beforeEach(async () => {
    await db.artworkImages.clear()
    await db.syncQueue.clear()
    await db.artworks.clear()
  })

  // A. Regression: the production sync path calls this with NO injected deps.
  // It previously defaulted to `async () => null`, skipped durable bytes, fell
  // through to the absent legacy artwork.image field, and returned
  // `missing_image` -- which is why no image ever reached R2.
  it('A. reads durable bytes with no injected deps', async () => {
    await saveDurableImageBytes('a-durable', IMAGE_KINDS.ORIGINAL, ORIGINAL_BYTES, 'image/jpeg')

    const result = await resolveArtworkImageForSync(artworkWithoutImages('a-durable'), IMAGE_KINDS.ORIGINAL, {
      fetchLibrary: emptyCloudLibrary,
    })

    assert.equal(result.ok, true, 'expected the durable image to resolve')
    assert.equal(result.source, 'durable')
    assert.equal(result.byteLength, ORIGINAL_BYTES.byteLength)
    assert.deepEqual(Array.from(result.bytes), Array.from(ORIGINAL_BYTES))
  })

  it('A2. resolves the durable thumbnail with no injected deps', async () => {
    await saveDurableImageBytes('a-thumb', IMAGE_KINDS.THUMBNAIL, THUMBNAIL_BYTES, 'image/jpeg')

    const result = await resolveArtworkImageForSync(artworkWithoutImages('a-thumb'), IMAGE_KINDS.THUMBNAIL, {
      fetchLibrary: emptyCloudLibrary,
    })

    assert.equal(result.ok, true)
    assert.equal(result.source, 'durable')
    assert.deepEqual(Array.from(result.bytes), Array.from(THUMBNAIL_BYTES))
  })

  it('A3. prefers durable bytes over a stale legacy blob', async () => {
    await saveDurableImageBytes('a-both', IMAGE_KINDS.ORIGINAL, ORIGINAL_BYTES, 'image/jpeg')
    const artwork = {
      ...artworkWithoutImages('a-both'),
      image: new Blob([new Uint8Array([9, 9, 9])], { type: 'image/jpeg' }),
    }

    const result = await resolveArtworkImageForSync(artwork, IMAGE_KINDS.ORIGINAL, {
      fetchLibrary: emptyCloudLibrary,
    })

    assert.equal(result.source, 'durable')
    assert.deepEqual(Array.from(result.bytes), Array.from(ORIGINAL_BYTES))
  })

  // B. Legacy pre-durable-storage artwork still resolve.
  it('B. falls back to a legacy artwork.image blob', async () => {
    const legacyBytes = new Uint8Array([7, 7, 7, 7])
    const artwork = {
      ...artworkWithoutImages('a-legacy'),
      image: new Blob([legacyBytes], { type: 'image/jpeg' }),
    }

    const result = await resolveArtworkImageForSync(artwork, IMAGE_KINDS.ORIGINAL, {
      fetchLibrary: emptyCloudLibrary,
    })

    assert.equal(result.ok, true)
    assert.equal(result.source, 'legacy')
    assert.deepEqual(Array.from(result.bytes), Array.from(legacyBytes))
  })

  it('B2. falls back to a legacy artwork.thumbnail blob', async () => {
    const artwork = {
      ...artworkWithoutImages('a-legacy-thumb'),
      thumbnail: new Blob([THUMBNAIL_BYTES], { type: 'image/jpeg' }),
    }

    const result = await resolveArtworkImageForSync(artwork, IMAGE_KINDS.THUMBNAIL, {
      fetchLibrary: emptyCloudLibrary,
    })

    assert.equal(result.ok, true)
    assert.equal(result.source, 'legacy')
  })

  // C. A genuinely absent image still reports missing_image...
  it('C. reports missing_image when nothing is stored locally', async () => {
    const result = await resolveArtworkImageForSync(artworkWithoutImages('a-none'), IMAGE_KINDS.ORIGINAL, {
      fetchLibrary: emptyCloudLibrary,
    })

    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'missing_image')
  })

  // ...and that must not destroy an unrelated artwork's durable record.
  it('C2. a missing read does not erase an unrelated durable record', async () => {
    await saveDurableImageBytes('a-untouched', IMAGE_KINDS.ORIGINAL, ORIGINAL_BYTES, 'image/jpeg')

    const result = await resolveArtworkImageForSync(artworkWithoutImages('a-none'), IMAGE_KINDS.ORIGINAL, {
      fetchLibrary: emptyCloudLibrary,
    })
    assert.equal(result.error.code, 'missing_image')

    const survivor = await getDurableImageRecord('a-untouched', IMAGE_KINDS.ORIGINAL)
    assert.equal(survivor.byteLength, ORIGINAL_BYTES.byteLength)
    assert.deepEqual(Array.from(new Uint8Array(survivor.data)), Array.from(ORIGINAL_BYTES))
  })
})

describe('markImageRecoveryRequired preserves local bytes', () => {
  before(async () => {
    await db.open()
  })

  beforeEach(async () => {
    await db.artworkImages.clear()
  })

  // D. The old implementation wrote `data: null, byteLength: 0` unconditionally,
  // so a single failed upload destroyed the only local copy of the image.
  it('D. keeps intact bytes while flagging recovery', async () => {
    await saveDurableImageBytes('d-1', IMAGE_KINDS.ORIGINAL, ORIGINAL_BYTES, 'image/jpeg')

    await markImageRecoveryRequired('d-1', IMAGE_KINDS.ORIGINAL, 'upload_failed')

    const record = await getDurableImageRecord('d-1', IMAGE_KINDS.ORIGINAL)
    assert.equal(record.recoveryRequired, true, 'should still flag recovery')
    assert.equal(record.recoveryReason, 'upload_failed')
    assert.equal(record.byteLength, ORIGINAL_BYTES.byteLength, 'byteLength must be preserved')
    assert.deepEqual(
      Array.from(new Uint8Array(record.data)),
      Array.from(ORIGINAL_BYTES),
      'image bytes must survive a failed upload',
    )
  })

  it('D2. clearing the flag makes the image usable again', async () => {
    await saveDurableImageBytes('d-2', IMAGE_KINDS.ORIGINAL, ORIGINAL_BYTES, 'image/jpeg')
    await markImageRecoveryRequired('d-2', IMAGE_KINDS.ORIGINAL, 'cloud_incomplete')

    assert.equal(await hasVerifiedDurableImage('d-2', IMAGE_KINDS.ORIGINAL), false)
    assert.equal(await hasStoredImageBytes('d-2', IMAGE_KINDS.ORIGINAL), true)

    await clearImageRecoveryRequired('d-2', IMAGE_KINDS.ORIGINAL)

    assert.equal(await hasVerifiedDurableImage('d-2', IMAGE_KINDS.ORIGINAL), true)
    const result = await resolveArtworkImageForSync(artworkWithoutImages('d-2'), IMAGE_KINDS.ORIGINAL, {
      fetchLibrary: emptyCloudLibrary,
    })
    assert.equal(result.ok, true)
    assert.equal(result.source, 'durable')
  })

  it('D3. a flagged-but-intact image is not condemned by a later missing read', async () => {
    await saveDurableImageBytes('d-3', IMAGE_KINDS.ORIGINAL, ORIGINAL_BYTES, 'image/jpeg')
    await markImageRecoveryRequired('d-3', IMAGE_KINDS.ORIGINAL, 'unreadable_blob')

    // This mirrors processor.js: a failed resolution must not re-flag bytes.
    const stored = await hasStoredImageBytes('d-3', IMAGE_KINDS.ORIGINAL)
    assert.equal(stored, true, 'intact bytes must still be detected')

    const record = await getDurableImageRecord('d-3', IMAGE_KINDS.ORIGINAL)
    assert.equal(record.byteLength, ORIGINAL_BYTES.byteLength)
  })

  it('D4. still records recovery when no bytes were ever stored', async () => {
    await markImageRecoveryRequired('d-4', IMAGE_KINDS.ORIGINAL, 'missing_image')

    const record = await getDurableImageRecord('d-4', IMAGE_KINDS.ORIGINAL)
    assert.equal(record.recoveryRequired, true)
    assert.equal(record.byteLength, 0)
    assert.equal(record.data, null)
  })
})

describe('reconcileIncompleteCloudImages requeues without clearing', () => {
  before(async () => {
    await db.open()
  })

  beforeEach(async () => {
    await db.artworkImages.clear()
    await db.syncQueue.clear()
    await db.artworks.clear()
    await db.syncImageHashes.clear()
  })

  // E. Durable bytes present but cloud keys missing => requeue the upload and
  // leave the local image untouched.
  it('E. requeues an upload when cloud keys are missing but local bytes exist', async () => {
    await saveDurableImageBytes('e-1', IMAGE_KINDS.ORIGINAL, ORIGINAL_BYTES, 'image/jpeg')
    await saveDurableImageBytes('e-1', IMAGE_KINDS.THUMBNAIL, THUMBNAIL_BYTES, 'image/jpeg')

    await reconcileIncompleteCloudImages('user-e', {
      force: true,
      fetchLibrary: async () => ({
        folders: [],
        artworks: [{ id: 'e-1', title: 'Study', hasOriginal: false, hasThumbnail: false }],
      }),
    })

    const original = await getDurableImageRecord('e-1', IMAGE_KINDS.ORIGINAL)
    assert.deepEqual(Array.from(new Uint8Array(original.data)), Array.from(ORIGINAL_BYTES))

    const jobs = await getSyncJobsForUser('user-e')
    const imageJobs = jobs.filter((job) => job.entityType === 'artwork-image')
    assert.equal(imageJobs.length, 1, 'expected the image upload to be requeued')
  })

  it('E2. requeues and un-flags an image that was flagged but still intact', async () => {
    await saveDurableImageBytes('e-2', IMAGE_KINDS.ORIGINAL, ORIGINAL_BYTES, 'image/jpeg')
    await saveDurableImageBytes('e-2', IMAGE_KINDS.THUMBNAIL, THUMBNAIL_BYTES, 'image/jpeg')
    await markImageRecoveryRequired('e-2', IMAGE_KINDS.ORIGINAL, 'missing_image')

    await reconcileIncompleteCloudImages('user-e2', {
      force: true,
      fetchLibrary: async () => ({
        folders: [],
        artworks: [{ id: 'e-2', title: 'Study', hasOriginal: false, hasThumbnail: false }],
      }),
    })

    const original = await getDurableImageRecord('e-2', IMAGE_KINDS.ORIGINAL)
    assert.equal(original.recoveryRequired, false, 'flag should clear once bytes are confirmed')
    assert.deepEqual(Array.from(new Uint8Array(original.data)), Array.from(ORIGINAL_BYTES))
  })

  it('E3. flags recovery only when no local bytes exist', async () => {
    await reconcileIncompleteCloudImages('user-e3', {
      force: true,
      fetchLibrary: async () => ({
        folders: [],
        artworks: [{ id: 'e-3', title: 'Study', hasOriginal: false, hasThumbnail: false }],
      }),
    })

    const record = await getDurableImageRecord('e-3', IMAGE_KINDS.ORIGINAL)
    assert.equal(record.recoveryRequired, true)
    assert.equal(record.data, null)
  })
})