import { Buffer } from 'node:buffer'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { beforeEach, test } from 'node:test'
import 'fake-indexeddb/auto'
import { extensionlessResolveHooks } from '../testResolveHook.mjs'
registerHooks(extensionlessResolveHooks)
const { getArtworkImageKinds } = await import('./artworkImageKeys.js')
const { db } = await import('./database.js')
const { saveDurableImageBytes, getDurableImageRecord } = await import('./artworkImageStorage.js')
const { resolveCloudImageForSync } = await import('./cloudDisplayService.js')
const { saveRestoredArtworkImage } = await import('./restoreService.js')
const { persistArtworkImages } = await import('./artworkService.js')
const { tryRepairArtworkImageFromCloud } = await import('./imageRepair.js')
const { migrateLegacyArtworkImage } = await import('./legacyImageMigration.js')
const { hashBytes } = await import('../sync/imageHash.js')
const { importLocalBackup } = await import('../utils/localBackup.js')
const { getFullImageBlob, getGalleryImageBlob } = await import('../utils/imageUtils.js')
const artwork = { id: 'art-1', title: 'Study' }
const original = new Uint8Array([255, 216, 255, 1, 2, 3])
const compressed = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80, 5])
const cloudBlob = () => new Blob([compressed], { type: 'image/webp' })
const noEncode = async () => { throw new Error('must not re-encode') }
beforeEach(async () => {
  await db.open()
  await db.artworkImages.clear()
  await db.artworks.clear()
  await db.artworks.put(artwork)
})

test('cache persists across sync calls; hash describes transmitted bytes, local bytes survive', async () => {
  await saveDurableImageBytes(artwork.id, 'original', original, 'image/jpeg')
  let calls = 0
  const first = await resolveCloudImageForSync(artwork, 'original', { createCloudDisplayImage: async () => {
    calls++
    return { blob: cloudBlob() }
  } })
  const second = await resolveCloudImageForSync(artwork, 'original', { createCloudDisplayImage: noEncode })
  assert.equal(calls, 1)
  assert.deepEqual(first.bytes, compressed)
  assert.deepEqual(second.bytes, compressed)
  assert.notEqual(await hashBytes(first.bytes), await hashBytes(original))
  assert.deepEqual(new Uint8Array((await getDurableImageRecord(artwork.id, 'original')).data), original)
})
test('source file is used only when it belongs to the current local rendering image', async () => {
  await saveDurableImageBytes(artwork.id, 'original', original, 'image/jpeg')
  const raw = new Uint8Array([10, 20, 30])
  await saveDurableImageBytes(artwork.id, 'source', raw, 'image/png', { sourceHash: await hashBytes(original) })
  await resolveCloudImageForSync(artwork, 'original', { createCloudDisplayImage: async blob => {
    assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), raw)
    return { blob: cloudBlob() }
  } })
  const replacement = new Uint8Array([255, 216, 255, 9])
  await saveDurableImageBytes(artwork.id, 'original', replacement, 'image/jpeg')
  await resolveCloudImageForSync(artwork, 'original', { createCloudDisplayImage: async blob => {
    assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), replacement)
    return { blob: cloudBlob() }
  } })
})
test('new device round-trip, retry, and missing display cache never re-encode cloud WebP', async () => {
  await saveRestoredArtworkImage(artwork.id, 'original', cloudBlob())
  await db.artworkImages.delete(`${artwork.id}:display`)
  for (let i = 0; i < 3; i++) {
    const result = await resolveCloudImageForSync(artwork, 'original', { createCloudDisplayImage: noEncode })
    assert.deepEqual(result.bytes, compressed)
    assert.equal(result.mimeType, 'image/webp')
  }
})
test('old cloud JPEG objects remain readable and are re-uploaded verbatim', async () => {
  await saveRestoredArtworkImage(artwork.id, 'original', new Blob([original], { type: 'image/jpeg' }))
  const result = await resolveCloudImageForSync(artwork, 'original', { createCloudDisplayImage: noEncode })
  assert.deepEqual(result.bytes, original)
  assert.equal(result.mimeType, 'image/jpeg')
})
test('cloud repair stores display and thumbnail exactly; source file survives restore', async () => {
  await saveDurableImageBytes(artwork.id, 'original', original, 'image/jpeg', { origin: 'local' })
  const options = {
    fetchLibrary: async () => ({ artworks: [{ id: artwork.id, hasOriginal: true, hasThumbnail: true }] }),
    downloadImage: async () => cloudBlob(),
  }
  assert.equal((await tryRepairArtworkImageFromCloud(artwork.id, 'original', options)).repaired, true)
  await tryRepairArtworkImageFromCloud(artwork.id, 'thumbnail', options)
  assert.deepEqual(new Uint8Array((await getDurableImageRecord(artwork.id, 'source')).data), original)
  assert.deepEqual(new Uint8Array((await getDurableImageRecord(artwork.id, 'thumbnail')).data), compressed)
  assert.deepEqual((await resolveCloudImageForSync(artwork, 'original', { createCloudDisplayImage: noEncode })).bytes, compressed)
})
test('legacy storage migration copies bytes without generational loss', async () => {
  const result = await migrateLegacyArtworkImage({ ...artwork, image: cloudBlob() }, 'original', { normalizeArtworkImage: noEncode })
  assert.equal(result.status, 'migrated')
  assert.deepEqual(new Uint8Array((await getDurableImageRecord(artwork.id, 'original')).data), compressed)
})
test('import retains true source and replacement invalidates the display cache', async () => {
  await saveDurableImageBytes(artwork.id, 'display', compressed, 'image/webp')
  await persistArtworkImages(artwork.id, new Blob([original], { type: 'image/jpeg' }), {
    createImageBitmap: async () => ({ width: 4000, height: 3000 }),
    createCanvas: () => ({ getContext: () => ({ fillRect() {}, drawImage() {} }) }),
    canvasToBlob: async () => new Blob([compressed], { type: 'image/jpeg' }),
  })
  assert.deepEqual(new Uint8Array((await getDurableImageRecord(artwork.id, 'source')).data), original)
  assert.equal(await getDurableImageRecord(artwork.id, 'display'), undefined)
})
test('local backup preserves cloud provenance and exact bytes, including source originals', async () => {
  await importLocalBackup({ backupVersion: 1, folders: [], artworks: [{ ...artwork,
    image: { data: Buffer.from(compressed).toString('base64'), type: 'image/webp', origin: 'cloud' },
    sourceImage: { data: Buffer.from(original).toString('base64'), type: 'image/jpeg', origin: 'local' },
  }] })
  const result = await resolveCloudImageForSync(artwork, 'original', { createCloudDisplayImage: noEncode })
  assert.deepEqual(result.bytes, compressed)
  assert.deepEqual(new Uint8Array((await getDurableImageRecord(artwork.id, 'source')).data), original)
})
test('detail/fullscreen prefers display over retina thumbnail on a restored device', () => {
  const image = cloudBlob(), thumbnail = new Blob(['thumb'], { type: 'image/jpeg' })
  assert.deepEqual(getArtworkImageKinds('detail'), ['original', 'thumbnail'])
  assert.deepEqual(getArtworkImageKinds('lightbox'), ['original', 'thumbnail'])
  assert.deepEqual(getArtworkImageKinds('gallery'), ['thumbnail', 'original'])
  assert.equal(getFullImageBlob({ image, thumbnail }), image)
  assert.equal(getGalleryImageBlob({ image, thumbnail }), thumbnail)
})
test('encoding failure does not destroy local data or leak full originals to upload', async () => {
  await saveDurableImageBytes(artwork.id, 'original', original, 'image/jpeg')
  await assert.rejects(resolveCloudImageForSync(artwork, 'original', { createCloudDisplayImage: noEncode }))
  assert.deepEqual(new Uint8Array((await getDurableImageRecord(artwork.id, 'original')).data), original)
  assert.equal(await getDurableImageRecord(artwork.id, 'display'), undefined)
})

test('replacement during encode cannot persist or upload a stale display', async () => {
  await saveDurableImageBytes(artwork.id, 'original', original, 'image/jpeg')
  await assert.rejects(resolveCloudImageForSync(artwork, 'original', { createCloudDisplayImage: async () => {
    await saveDurableImageBytes(artwork.id, 'original', new Uint8Array([8, 9]), 'image/jpeg')
    return { blob: cloudBlob() }
  } }), /Image changed/)
  assert.equal(await getDurableImageRecord(artwork.id, 'display'), undefined)
})
test('old backups cannot delete this device’s untouched source', async () => {
  await saveDurableImageBytes(artwork.id, 'source', original, 'image/jpeg', { origin: 'local' })
  await importLocalBackup({ backupVersion: 1, folders: [], artworks: [{ ...artwork,
    image: { data: Buffer.from(compressed).toString('base64'), type: 'image/webp', origin: 'cloud' },
  }] })
  assert.deepEqual(new Uint8Array((await getDurableImageRecord(artwork.id, 'source')).data), original)
})

test('force-save completion records transmitted hashes even after local replacement', async () => {
  const { recordForceSyncComplete } = await import('../sync/processor.js')
  await saveDurableImageBytes(artwork.id, 'original', original, 'image/jpeg')
  const transmitted = await hashBytes(compressed)
  await recordForceSyncComplete('user', new Map([[artwork.id, { originalHash: transmitted }]]))
  const hashes = await db.syncImageHashes.where('userId').equals('user').first()
  assert.equal(hashes.originalHash, transmitted)
  assert.notEqual(hashes.originalHash, await hashBytes(original))
})
