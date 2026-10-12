import { db } from './database.js'
import { buildArtworkImageId, IMAGE_KINDS } from './artworkImageKeys.js'
import { notifyArtworkImagesChanged } from './imageChangeEvents.js'
import { bytesToBlob } from './readStoredImageBytes.js'

function normalizeBytes(bytes) {
  if (bytes instanceof Uint8Array) {
    return bytes
  }
  if (bytes instanceof ArrayBuffer) {
    return new Uint8Array(bytes)
  }
  if (ArrayBuffer.isView(bytes)) {
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }
  throw new Error('Image bytes must be an ArrayBuffer or typed array.')
}

function readStoredBytes(record) {
  if (!record?.data) {
    return null
  }
  const bytes = record.data instanceof Uint8Array ? record.data : new Uint8Array(record.data)
  return bytes.byteLength > 0 ? bytes : null
}

/**
 * True when the record holds self-consistent, non-empty local bytes,
 * regardless of the recoveryRequired flag.
 */
function hasUsableBytes(record) {
  const bytes = readStoredBytes(record)
  return Boolean(bytes && record.byteLength > 0 && bytes.byteLength === record.byteLength)
}

export async function getDurableImageRecord(artworkId, kind) {
  return db.artworkImages.get(buildArtworkImageId(artworkId, kind))
}

export async function hasVerifiedDurableImage(artworkId, kind) {
  const record = await getDurableImageRecord(artworkId, kind)
  if (!record || record.recoveryRequired) {
    return false
  }
  return hasUsableBytes(record)
}

/**
 * Byte-presence probe that ignores recoveryRequired.
 *
 * Callers use this to tell "local bytes are gone" apart from "local bytes exist
 * but are flagged", so a flagged-but-intact image is re-queued rather than
 * re-flagged (which would otherwise deadlock the reconcile loop).
 */
export async function hasStoredImageBytes(artworkId, kind) {
  return hasUsableBytes(await getDurableImageRecord(artworkId, kind))
}

export async function saveDurableImageBytes(artworkId, kind, bytes, mimeType, options = {}) {
  const normalized = normalizeBytes(bytes)
  if (normalized.byteLength === 0) {
    throw new Error('Refusing to store empty image bytes.')
  }

  const id = buildArtworkImageId(artworkId, kind)
  const record = {
    id,
    artworkId,
    kind,
    mimeType: (mimeType || 'application/octet-stream').split(';')[0].trim().toLowerCase(),
    byteLength: normalized.byteLength,
    data: normalized.buffer.slice(
      normalized.byteOffset,
      normalized.byteOffset + normalized.byteLength,
    ),
    recoveryRequired: false,
    recoveryReason: null,
    migratedFromLegacy: Boolean(options.migratedFromLegacy),
    origin: options.origin ?? null,
    sourceHash: options.sourceHash ?? null,
    policyVersion: options.policyVersion ?? null,
    updatedAt: new Date().toISOString(),
  }

  await db.artworkImages.put(record)

  const verify = await db.artworkImages.get(id)
  const verifiedBytes =
    verify?.data instanceof Uint8Array ? verify.data : new Uint8Array(verify?.data || [])
  if (!verify || verifiedBytes.byteLength !== record.byteLength) {
    throw new Error('Durable image verification failed after write.')
  }

  notifyArtworkImagesChanged(artworkId)
  return record
}

/**
 * Flag an image as needing attention WITHOUT discarding local bytes.
 *
 * Local IndexedDB bytes are authoritative: a failed read, failed upload,
 * unavailable R2, or expired auth must never destroy the only local copy.
 * Existing self-consistent bytes are preserved alongside the recovery flag;
 * bytes are only cleared when nothing usable was stored to begin with.
 */
export async function markImageRecoveryRequired(artworkId, kind, reason = 'unreadable_blob') {
  const id = buildArtworkImageId(artworkId, kind)
  const existing = await db.artworkImages.get(id)
  const preserveBytes = hasUsableBytes(existing)

  await db.artworkImages.put({
    ...(preserveBytes ? existing : {}),
    id,
    artworkId,
    kind,
    mimeType: existing?.mimeType ?? null,
    byteLength: preserveBytes ? existing.byteLength : 0,
    data: preserveBytes ? existing.data : null,
    recoveryRequired: true,
    recoveryReason: reason,
    migratedFromLegacy: existing?.migratedFromLegacy ?? false,
    updatedAt: new Date().toISOString(),
  })

  notifyArtworkImagesChanged(artworkId)
}

export async function clearImageRecoveryRequired(artworkId, kind) {
  const record = await getDurableImageRecord(artworkId, kind)
  if (!record) {
    return
  }
  await db.artworkImages.put({
    ...record,
    recoveryRequired: false,
    recoveryReason: null,
    updatedAt: new Date().toISOString(),
  })

  notifyArtworkImagesChanged(artworkId)
}

export async function deleteDurableImagesForArtwork(artworkId) {
  await db.artworkImages.where('artworkId').equals(artworkId).delete()
  notifyArtworkImagesChanged(artworkId)
}

export async function getArtworksNeedingImageRecovery() {
  const [records, localArtworks] = await Promise.all([
    db.artworkImages.filter((record) => record.recoveryRequired).toArray(),
    db.artworks.toArray(),
  ])

  const localById = new Map(localArtworks.map((artwork) => [artwork.id, artwork]))

  const byArtwork = new Map()
  for (const record of records) {
    // A flagged record with no local artwork row is an orphan: the artwork was
    // deleted, or the flag came from a deleted/test record. There is nothing
    // the user can re-select, so it must never appear as repair work.
    if (!localById.has(record.artworkId)) {
      continue
    }

    const entry = byArtwork.get(record.artworkId) || {
      artworkId: record.artworkId,
      kinds: [],
      reasons: [],
    }
    entry.kinds.push(record.kind)
    if (record.recoveryReason) {
      entry.reasons.push(record.recoveryReason)
    }
    byArtwork.set(record.artworkId, entry)
  }

  return Array.from(byArtwork.values())
}

/**
 * Drop recovery-flagged durable-image rows that belong to no existing artwork.
 *
 * A reconcile pass that ran after an artwork was deleted (or against a stale
 * sync job) can leave an orphan flagged behind. Such a record can never be
 * repaired -- there is no artwork to re-select an image for -- and it surfaces
 * as a permanent phantom "Untitled artwork" warning.
 *
 * Only rows flagged `recoveryRequired` are removed, so bytes written by a
 * concurrent create (which always writes unflagged) are never caught.
 */
export async function deleteOrphanRecoveryImageRecords() {
  const localArtworks = await db.artworks.toArray()
  const localIds = new Set(localArtworks.map((artwork) => artwork.id))
  const orphanIds = await db.artworkImages
    .filter((record) => record.recoveryRequired && !localIds.has(record.artworkId))
    .primaryKeys()

  if (!orphanIds.length) {
    return 0
  }

  await db.artworkImages.bulkDelete(orphanIds)
  return orphanIds.length
}

export async function readDurableImageAsBlob(artworkId, kind) {
  const record = await getDurableImageRecord(artworkId, kind)
  if (!record?.data || record.recoveryRequired || !record.byteLength) {
    return null
  }

  const bytes = record.data instanceof Uint8Array ? record.data : new Uint8Array(record.data)
  if (bytes.byteLength !== record.byteLength) {
    return null
  }

  return bytesToBlob(bytes, record.mimeType)
}

export async function listArtworkIdsMissingDurableImages(artworkIds) {
  const missing = []
  for (const artworkId of artworkIds) {
    const hasOriginal = await hasVerifiedDurableImage(artworkId, IMAGE_KINDS.ORIGINAL)
    const hasThumbnail = await hasVerifiedDurableImage(artworkId, IMAGE_KINDS.THUMBNAIL)
    if (!hasOriginal || !hasThumbnail) {
      missing.push(artworkId)
    }
  }
  return missing
}

export { IMAGE_KINDS }
