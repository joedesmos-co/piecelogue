import { db } from './database.js'
import { IMAGE_KINDS } from './artworkImageKeys.js'
import {
  getDurableImageRecord,
  hasVerifiedDurableImage,
  markImageRecoveryRequired,
  saveDurableImageBytes,
} from './artworkImageStorage.js'
import {
  logImageReadDiagnostic,
  readBytesFromBlobValue,
  readStoredImageBytes,
} from './readStoredImageBytes.js'

export const LEGACY_IMAGE_MIGRATION_BATCH_SIZE = 5
const MIGRATION_CURSOR_KEY = 'legacyImageMigrationCursor'

function getLegacyBlobForKind(artwork, kind) {
  if (kind === IMAGE_KINDS.THUMBNAIL) {
    return artwork.thumbnail ?? null
  }
  return artwork.image ?? null
}

function isBlobLike(value) {
  if (!value || typeof value !== 'object') {
    return false
  }
  return (
    value instanceof Blob ||
    value instanceof File ||
    Object.prototype.toString.call(value) === '[object Blob]'
  )
}

export async function migrateLegacyArtworkImage(artwork, kind, deps = {}) {
  const artworkId = artwork.id
  const hasVerified = deps.hasVerifiedDurableImage ?? hasVerifiedDurableImage
  const getRecord = deps.getDurableImageRecord ?? getDurableImageRecord
  const saveDurable = deps.saveDurableImageBytes ?? saveDurableImageBytes
  const markRecovery = deps.markImageRecoveryRequired ?? markImageRecoveryRequired

  if (await hasVerified(artworkId, kind)) {
    return { status: 'skipped', artworkId, kind }
  }

  const existingRecord = await getRecord(artworkId, kind)
  if (existingRecord?.recoveryRequired) {
    return { status: 'recovery_required', artworkId, kind }
  }

  const legacyBlob = getLegacyBlobForKind(artwork, kind)
  if (!isBlobLike(legacyBlob)) {
    return { status: 'missing', artworkId, kind }
  }

  const readResult = await readStoredImageBytes(
    artworkId,
    kind,
    { legacyBlob },
    {
      getDurableRecord: getRecord,
      ...deps,
    },
  )

  if (!readResult.ok) {
    logImageReadDiagnostic('image.migration.read_failed', readResult.diagnostic)
    await markRecovery(artworkId, kind, readResult.error.code)
    return { status: 'recovery_required', artworkId, kind, error: readResult.error }
  }

  await saveDurable(artworkId, kind, readResult.bytes, readResult.mimeType, {
    migratedFromLegacy: true,
  })

  logImageReadDiagnostic('image.migration.success', {
    artworkId,
    kind,
    source: readResult.source,
    byteLength: readResult.byteLength,
    mimeType: readResult.mimeType,
  })

  return { status: 'migrated', artworkId, kind, byteLength: readResult.byteLength }
}

export async function migrateLegacyArtworkImages(artwork, deps = {}) {
  const results = []
  for (const kind of [IMAGE_KINDS.ORIGINAL, IMAGE_KINDS.THUMBNAIL]) {
    results.push(await migrateLegacyArtworkImage(artwork, kind, deps))
  }
  return results
}

function readMigrationCursor() {
  try {
    const raw = localStorage.getItem(MIGRATION_CURSOR_KEY)
    return raw ? Number.parseInt(raw, 10) : 0
  } catch {
    return 0
  }
}

function writeMigrationCursor(index) {
  try {
    localStorage.setItem(MIGRATION_CURSOR_KEY, String(index))
  } catch {
    // Ignore storage failures.
  }
}

export async function runLegacyImageMigrationBatch(options = {}) {
  const batchSize = options.batchSize ?? LEGACY_IMAGE_MIGRATION_BATCH_SIZE
  const artworks = await db.artworks.orderBy('updatedAt').toArray()
  const cursor = Number.isFinite(options.cursor) ? options.cursor : readMigrationCursor()
  const batch = artworks.slice(cursor, cursor + batchSize)
  const results = []

  for (const artwork of batch) {
    results.push(...(await migrateLegacyArtworkImages(artwork, options.deps)))
  }

  const nextCursor = cursor + batch.length
  if (nextCursor >= artworks.length) {
    writeMigrationCursor(0)
  } else {
    writeMigrationCursor(nextCursor)
  }

  return {
    processed: batch.length,
    total: artworks.length,
    cursor,
    nextCursor: nextCursor >= artworks.length ? 0 : nextCursor,
    complete: nextCursor >= artworks.length,
    results,
  }
}

export async function ensureArtworkImagesMigrated(artworkId, deps = {}) {
  const artwork = await db.artworks.get(artworkId)
  if (!artwork) {
    return []
  }
  return migrateLegacyArtworkImages(artwork, deps)
}

export async function writeIncomingImageBytes(artworkId, kind, sourceBlob, deps = {}) {
  const read = await readBytesFromBlobValue(sourceBlob, { artworkId, kind }, deps)
  await saveDurableImageBytes(artworkId, kind, read.bytes, read.mimeType)
  return read
}

export { readBytesFromBlobValue }
