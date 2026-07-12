import { db } from './database.js'
import { buildArtworkImageId, IMAGE_KINDS } from './artworkImageKeys.js'
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

export async function getDurableImageRecord(artworkId, kind) {
  return db.artworkImages.get(buildArtworkImageId(artworkId, kind))
}

export async function hasVerifiedDurableImage(artworkId, kind) {
  const record = await getDurableImageRecord(artworkId, kind)
  if (!record || record.recoveryRequired) {
    return false
  }
  if (!record.data || !record.byteLength) {
    return false
  }
  const bytes =
    record.data instanceof Uint8Array ? record.data : new Uint8Array(record.data)
  return bytes.byteLength === record.byteLength && bytes.byteLength > 0
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
    updatedAt: new Date().toISOString(),
  }

  await db.artworkImages.put(record)

  const verify = await db.artworkImages.get(id)
  const verifiedBytes =
    verify?.data instanceof Uint8Array ? verify.data : new Uint8Array(verify?.data || [])
  if (!verify || verifiedBytes.byteLength !== record.byteLength) {
    throw new Error('Durable image verification failed after write.')
  }

  return record
}

export async function markImageRecoveryRequired(artworkId, kind, reason = 'unreadable_blob') {
  const id = buildArtworkImageId(artworkId, kind)
  const existing = await db.artworkImages.get(id)
  await db.artworkImages.put({
    id,
    artworkId,
    kind,
    mimeType: existing?.mimeType ?? null,
    byteLength: 0,
    data: null,
    recoveryRequired: true,
    recoveryReason: reason,
    migratedFromLegacy: existing?.migratedFromLegacy ?? false,
    updatedAt: new Date().toISOString(),
  })
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
}

export async function deleteDurableImagesForArtwork(artworkId) {
  await db.artworkImages.where('artworkId').equals(artworkId).delete()
}

export async function getArtworksNeedingImageRecovery() {
  const records = await db.artworkImages
    .filter((record) => record.recoveryRequired)
    .toArray()

  const byArtwork = new Map()
  for (const record of records) {
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
