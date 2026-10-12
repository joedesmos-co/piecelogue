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
  saveDurableImageBytes,
  deleteDurableImagesForArtwork,
} = await import('./artworkImageStorage.js')
const { saveRestoredArtworkImage } = await import('./restoreService.js')
const { getAllFolders, createFolder } = await import('./folderService.js')
const {
  buildFolderPreviews,
  selectFolderPreviewArtworks,
  toFolderPreviewRecord,
} = await import('./folderPreviewService.js')

const ORIGINAL_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0x01, 0x02, 0x03, 0x04, 0x05])
const THUMBNAIL_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xaa, 0xbb, 0xcc])

async function addArtwork(id, title, folderId, updatedAt, { image = false } = {}) {
  const record = {
    id,
    title,
    mediumType: 'Traditional',
    medium: '',
    status: 'In Progress',
    hours: 0,
    minutes: 0,
    totalMinutes: 0,
    durationUnknown: false,
    notes: '',
    favorite: false,
    folderId,
    createdAt: updatedAt,
    updatedAt,
  }

  if (image) {
    // Legacy records carried inline blobs that the preview path must not need.
    record.image = new Blob([new Uint8Array([9, 9, 9])], { type: 'image/jpeg' })
    record.thumbnail = new Blob([new Uint8Array([8, 8, 8])], { type: 'image/jpeg' })
  }

  await db.artworks.put(record)
  return record
}

async function addDurableImages(id) {
  await saveDurableImageBytes(id, IMAGE_KINDS.ORIGINAL, ORIGINAL_BYTES, 'image/jpeg', {
    origin: 'local',
  })
  await saveDurableImageBytes(id, IMAGE_KINDS.THUMBNAIL, THUMBNAIL_BYTES, 'image/jpeg', {
    origin: 'local',
  })
}

describe('folder preview selection', () => {
  before(async () => {
    await db.open()
  })

  beforeEach(async () => {
    await db.artworkImages.clear()
    await db.artworks.clear()
    await db.folders.clear()
  })

  it('takes the newest artworks, newest first', () => {
    const artwork = [
      { id: 'old', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'new', updatedAt: '2026-02-01T00:00:00.000Z' },
      { id: 'mid', updatedAt: '2026-01-15T00:00:00.000Z' },
    ]

    assert.deepEqual(
      selectFolderPreviewArtworks(artwork).map((a) => a.id),
      ['new', 'mid', 'old'],
    )
  })

  it('builds a preview descriptor even when no image exists yet', () => {
    // A damaged or missing image must still occupy a preview cell so the folder
    // shows the same number of cells as its artwork count.
    const previews = buildFolderPreviews([
      { id: 'no-image', title: 'Empty', updatedAt: '2026-01-01T00:00:00.000Z' },
    ])
    assert.equal(previews.length, 1)
    assert.equal(previews[0].id, 'no-image')
    assert.equal(previews[0].title, 'Empty')
  })

  it('does not copy inline legacy image blobs into the preview record', () => {
    const previews = buildFolderPreviews([
      {
        id: 'legacy',
        title: 'Legacy',
        updatedAt: '2026-01-01T00:00:00.000Z',
        image: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
        thumbnail: new Blob([new Uint8Array([4, 5, 6])], { type: 'image/jpeg' }),
      },
    ])

    assert.equal(previews.length, 1)
    assert.equal('image' in previews[0], false)
    assert.equal('thumbnail' in previews[0], false)
  })

  it('drops rows that cannot identify an artwork', () => {
    assert.deepEqual(buildFolderPreviews([{ title: 'No id' }]), [])
    assert.equal(toFolderPreviewRecord(null), null)
  })

  it('previews only the folder own artwork', async () => {
    await createFolder('Sketchbook')
    const folders = await getAllFolders()
    const folderId = folders[0].id

    await addArtwork('in-folder', 'In Folder', folderId, '2026-01-01T00:00:00.000Z')
    await addArtwork('outside', 'Outside', null, '2026-01-02T00:00:00.000Z')

    const folder = await getAllFolders().then((rows) => rows[0])
    assert.deepEqual(folder.previews.map((p) => p.id), ['in-folder'])
    assert.equal(folder.count, 1)
  })
})

describe('folder previews resolve through the durable image store', () => {
  before(async () => {
    await db.open()
  })

  beforeEach(async () => {
    await db.artworkImages.clear()
    await db.artworks.clear()
    await db.folders.clear()
  })

  it('three artworks with local durable images yield three readable previews', async () => {
    const folder = await createFolder('Traditional')
    const folderId = folder.id

    await addArtwork('t-1', 'One', folderId, '2026-03-01T00:00:00.000Z')
    await addArtwork('t-2', 'Two', folderId, '2026-02-01T00:00:00.000Z')
    await addArtwork('t-3', 'Three', folderId, '2026-01-01T00:00:00.000Z')
    await addDurableImages('t-1')
    await addDurableImages('t-2')
    await addDurableImages('t-3')

    const [enriched] = (await getAllFolders()).filter((row) => row.id === folderId)
    assert.equal(enriched.count, 3)
    assert.equal(enriched.previews.length, 3)

    for (const preview of enriched.previews) {
      const original = await getDurableImageRecord(preview.id, IMAGE_KINDS.ORIGINAL)
      const thumbnail = await getDurableImageRecord(preview.id, IMAGE_KINDS.THUMBNAIL)
      assert.ok(original, 'preview artwork must resolve durable original bytes')
      assert.ok(thumbnail, 'preview artwork must resolve durable thumbnail bytes')
      assert.equal(original.recoveryRequired, false)
    }
  })

  it('a cloud-restored image becomes available for the folder preview', async () => {
    const folder = await createFolder('Restored')
    const folderId = folder.id

    // Metadata exists on this device, but the image does not: exactly the state
    // a fresh device is in before the background restore downloads bytes.
    await addArtwork('r-1', 'Restored Piece', folderId, '2026-04-01T00:00:00.000Z')

    let [enriched] = (await getAllFolders()).filter((row) => row.id === folderId)
    assert.equal(enriched.previews.length, 1)
    assert.equal(await getDurableImageRecord('r-1', IMAGE_KINDS.THUMBNAIL), undefined)

    await saveRestoredArtworkImage('r-1', 'thumbnail', new Blob([THUMBNAIL_BYTES], { type: 'image/jpeg' }))

    ;[enriched] = (await getAllFolders()).filter((row) => row.id === folderId)
    assert.equal(enriched.previews.length, 1)

    const thumbnail = await getDurableImageRecord('r-1', IMAGE_KINDS.THUMBNAIL)
    assert.ok(thumbnail)
    assert.equal(thumbnail.byteLength, THUMBNAIL_BYTES.byteLength)
    assert.equal(thumbnail.recoveryRequired, false)
  })

  it('a preview cell survives a deleted artwork row', async () => {
    const folder = await createFolder('Mixed')
    const folderId = folder.id
    await addArtwork('m-1', 'Kept', folderId, '2026-04-02T00:00:00.000Z')
    await addArtwork('m-2', 'Removed', folderId, '2026-04-01T00:00:00.000Z')

    await deleteDurableImagesForArtwork('m-2')
    await db.artworks.delete('m-2')

    const [enriched] = (await getAllFolders()).filter((row) => row.id === folderId)
    assert.equal(enriched.count, 1)
    assert.deepEqual(enriched.previews.map((p) => p.id), ['m-1'])
  })
})
