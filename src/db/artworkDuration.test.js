import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { beforeEach, describe, it } from 'node:test'
import { extensionlessResolveHooks } from '../testResolveHook.mjs'

registerHooks(extensionlessResolveHooks)
await import('fake-indexeddb/auto')

const { db } = await import('./database.js')
const {
  createArtwork,
  getArtworkById,
  getStats,
  updateArtwork,
} = await import('./artworkService.js')
const { serializeArtwork } = await import('../utils/localBackup.js')
const { validateLocalBackup } = await import('../utils/localBackupCore.js')

let counter = 0

async function insertArtwork(overrides = {}) {
  counter += 1
  const now = new Date().toISOString()
  const record = {
    id: `art-${counter}`,
    title: `Piece ${counter}`,
    mediumType: 'Digital',
    medium: '',
    folderId: null,
    status: 'Finished',
    hours: 0,
    minutes: 0,
    totalMinutes: 0,
    artworkDate: null,
    notes: '',
    favorite: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
  await db.artworks.put(record)
  return record
}

beforeEach(async () => {
  await db.artworks.clear()
  await db.artworkImages.clear()
})

describe('unknown duration artwork lifecycle', () => {
  it('reads an unknown-time record as null, not 0', async () => {
    const inserted = await insertArtwork({
      title: 'Unsure piece',
      hours: null,
      minutes: null,
      totalMinutes: null,
      durationUnknown: true,
    })
    const artwork = await getArtworkById(inserted.id)
    assert.equal(artwork.durationUnknown, true)
    assert.equal(artwork.totalMinutes, null)
    assert.equal(artwork.hours, null)
  })

  it('preserves unknown through edit and round-trips known conversions', async () => {
    const inserted = await insertArtwork({
      title: 'Piece',
      hours: null,
      minutes: null,
      totalMinutes: null,
      durationUnknown: true,
    })
    const edited = await updateArtwork(inserted.id, { notes: 'still unsure' })
    assert.equal(edited.durationUnknown, true)
    assert.equal(edited.totalMinutes, null)

    const known = await updateArtwork(inserted.id, {
      durationUnknown: false,
      hours: 2,
      minutes: 30,
    })
    assert.equal(known.durationUnknown, false)
    assert.equal(known.totalMinutes, 150)

    const backToUnknown = await updateArtwork(inserted.id, { durationUnknown: true })
    assert.equal(backToUnknown.durationUnknown, true)
    assert.equal(backToUnknown.totalMinutes, null)
  })

  it('switches known to unknown by clearing the flag fields', async () => {
    const inserted = await insertArtwork({ title: 'Timed', hours: 1, minutes: 0, totalMinutes: 60 })
    const updated = await updateArtwork(inserted.id, { durationUnknown: true })
    assert.equal(updated.totalMinutes, null)
    assert.equal(formatUnknownCheck(updated), true)
  })

  it('excludes unknown durations from stats totals and averages', async () => {
    await insertArtwork({ title: 'Known', hours: 2, minutes: 0, totalMinutes: 120 })
    await insertArtwork({
      title: 'Unknown',
      hours: null,
      minutes: null,
      totalMinutes: null,
      durationUnknown: true,
    })

    const stats = await getStats()
    assert.equal(stats.totalArtworks, 2)
    assert.equal(stats.unknownCount, 1)
    assert.equal(stats.trackedCount, 1)
    assert.equal(stats.totalMinutes, 120)
    assert.equal(stats.averageMinutes, 120)
    assert.equal(stats.digitalMinutes, 120)
  })

  it('counts legacy zero-minute rows as known, not unknown', async () => {
    await insertArtwork({ title: 'Quick', mediumType: 'Other', hours: 0, minutes: 0, totalMinutes: 0 })
    const stats = await getStats()
    assert.equal(stats.unknownCount, 0)
    assert.equal(stats.trackedCount, 1)
    assert.equal(stats.totalMinutes, 0)
  })

  it('round-trips unknown duration through backup serialize + validate', async () => {
    const record = serializeArtwork({
      id: 'a1',
      title: 'Unsure',
      mediumType: 'Digital',
      status: 'Finished',
      hours: null,
      minutes: null,
      totalMinutes: null,
      durationUnknown: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })
    assert.equal(record.durationUnknown, true)
    assert.equal(record.totalMinutes, null)

    const validated = validateLocalBackup({
      backupVersion: 1,
      app: 'Piecelogue',
      appVersion: '0.1.0',
      exportedAt: '2026-01-02T00:00:00.000Z',
      folderCount: 0,
      artworkCount: 1,
      folders: [],
      artworks: [record],
    })
    assert.equal(validated.artworks[0].durationUnknown, true)
    assert.equal(validated.artworks[0].totalMinutes, null)
  })

  it('createArtwork validates titles without touching image normalization', async () => {
    // createArtwork requires an image blob; with a null blob it must fail
    // before any duration logic runs.
    await assert.rejects(() => createArtwork({ title: 'No image' }, null), /image is required/)
  })
})

function formatUnknownCheck(artwork) {
  return artwork.durationUnknown === true && artwork.totalMinutes == null
}
