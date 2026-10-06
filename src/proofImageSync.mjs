/**
 * Safe local proof of the repaired image-sync chain. Runs entirely on
 * fake-indexeddb + in-memory Dexie. No network, no production, no deploy.
 *
 *   local artwork image
 *   -> durable artworkImages (what persistArtworkImages writes)
 *   -> resolver reads durable bytes (processor.js:294 call shape)
 *   -> prepareBytesForUpload yields a valid upload body
 */
import { registerHooks } from 'node:module'
import { extensionlessResolveHooks } from './testResolveHook.mjs'

registerHooks(extensionlessResolveHooks)
await import('fake-indexeddb/auto')

const { db } = await import('./db/database.js')
const { IMAGE_KINDS } = await import('./db/artworkImageKeys.js')
const { saveDurableImageBytes, getDurableImageRecord } = await import(
  './db/artworkImageStorage.js'
)
const { resolveArtworkImageForSync } = await import('./db/imageRepair.js')
const { shouldUploadImage, hashBytes } = await import('./sync/imageHash.js')
const { prepareBytesForUpload } = await import('./sync/imageUpload.js')

await db.open()

const ARTWORK_ID = 'proof-artwork-1'
// A tiny but structurally valid JPEG (SOI + APP0/JFIF + EOI).
const jpegBytes = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
])

// --- Step 1: local artwork image -> durable artworkImages ---
// Mirrors artworkService.persistArtworkImages() after canvas normalization.
await saveDurableImageBytes(ARTWORK_ID, IMAGE_KINDS.ORIGINAL, jpegBytes, 'image/jpeg')
await saveDurableImageBytes(
  ARTWORK_ID,
  IMAGE_KINDS.THUMBNAIL,
  jpegBytes.slice(0, 12),
  'image/jpeg',
)

const stored = await getDurableImageRecord(ARTWORK_ID, IMAGE_KINDS.ORIGINAL)
console.log(`1. durable artworkImages      : ${stored.byteLength} bytes, ${stored.mimeType}`)

// The artwork record holds NO image fields (post-7d83cb0 behaviour).
const artwork = {
  id: ARTWORK_ID,
  title: 'Proof',
  mediumType: 'Digital',
  status: 'In Progress',
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
}
console.log(`   artwork.image present      : ${'image' in artwork}`)

// --- Step 2: resolver reads durable bytes, exactly as processor.js:294 calls it ---
const resolved = await resolveArtworkImageForSync(artwork, IMAGE_KINDS.ORIGINAL, {
  fetchLibrary: async () => ({ folders: [], artworks: [] }),
})
if (!resolved.ok) {
  console.error(`FAIL: resolver returned ${resolved.error.code}`)
  process.exit(1)
}
console.log(`2. resolver ok=${resolved.ok} source=${resolved.source} bytes=${resolved.byteLength}`)

// --- Step 3: hash gate decides an upload is needed ---
const localHash = await hashBytes(resolved.bytes)
const needsUpload = shouldUploadImage(localHash, null)
console.log(`3. shouldUploadImage (no prior hash): ${needsUpload}`)

// --- Step 4: upload body is valid and within limits ---
const prepared = await prepareBytesForUpload(resolved.bytes, {
  stage: 'original',
  mimeType: resolved.mimeType,
  artworkId: ARTWORK_ID,
})
console.log(
  `4. upload body ready          : ${prepared.format} ${prepared.mimeType} ` +
    `${prepared.byteSize} bytes exceedsLimit=${prepared.exceedsLimit}`,
)

const ok =
  resolved.ok &&
  resolved.source === 'durable' &&
  needsUpload &&
  prepared.byteSize === jpegBytes.byteLength &&
  prepared.format === 'JPEG'

console.log(ok ? '\nPROOF PASSED: durable bytes reach a valid upload body.' : '\nPROOF FAILED')
await db.delete()
process.exit(ok ? 0 : 1)