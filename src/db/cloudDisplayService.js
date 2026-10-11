import { db } from './database.js'
import { IMAGE_KINDS } from './artworkImageKeys.js'
import { getDurableImageRecord, saveDurableImageBytes } from './artworkImageStorage.js'
import { resolveArtworkImageForSync } from './imageRepair.js'
import { createCloudDisplayImage, CLOUD_DISPLAY_VERSION } from '../utils/imageNormalize.js'
import { hashBytes } from '../sync/imageHash.js'

function usable(record) {
  return record?.data && !record.recoveryRequired && record.byteLength > 0 && record.data.byteLength === record.byteLength
}

/** The only source resolver for outbound full-size cloud images. */
export async function resolveCloudImageForSync(artwork, kind, options = {}) {
  const result = await resolveArtworkImageForSync(artwork, kind, options)
  if (!result.ok || kind !== IMAGE_KINDS.ORIGINAL) return result

  const original = await getDurableImageRecord(artwork.id, IMAGE_KINDS.ORIGINAL)
  if (original?.data && (original.data.byteLength !== result.bytes.byteLength ||
      !new Uint8Array(original.data).every((byte, i) => byte === result.bytes[i]))) {
    throw new Error('Image changed while reading cloud source. Sync will retry.')
  }
  // Cloud provenance wins even if the display cache was evicted. This includes
  // legacy JPEG/PNG objects: downloading one never authorizes transcoding it.
  if (original?.origin === 'cloud') return result

  const sourceHash = await hashBytes(result.bytes)
  const cached = await getDurableImageRecord(artwork.id, IMAGE_KINDS.DISPLAY)
  if (usable(cached) && cached.sourceHash === sourceHash && cached.policyVersion === CLOUD_DISPLAY_VERSION) {
    return { ...result, bytes: new Uint8Array(cached.data), mimeType: cached.mimeType }
  }

  const source = await getDurableImageRecord(artwork.id, IMAGE_KINDS.SOURCE)
  const sourceBlob = usable(source) && source.sourceHash === sourceHash
    ? new Blob([source.data], { type: source.mimeType })
    : new Blob([result.bytes], { type: result.mimeType })
  const display = await (options.createCloudDisplayImage ?? createCloudDisplayImage)(sourceBlob)
  const bytes = new Uint8Array(await display.blob.arrayBuffer())
  await db.transaction('rw', db.artworkImages, async () => {
    const current = await getDurableImageRecord(artwork.id, IMAGE_KINDS.ORIGINAL)
    if ((original && (!current?.data || current.origin !== original.origin)) ||
        (current?.data && (current.data.byteLength !== result.bytes.byteLength ||
          !new Uint8Array(current.data).every((byte, i) => byte === result.bytes[i])))) {
      throw new Error('Image changed while preparing cloud copy. Sync will retry.')
    }
    await saveDurableImageBytes(artwork.id, IMAGE_KINDS.DISPLAY, bytes, display.blob.type, {
      origin: 'local', sourceHash, policyVersion: CLOUD_DISPLAY_VERSION,
    })
  })
  return { ...result, bytes, mimeType: display.blob.type }
}
