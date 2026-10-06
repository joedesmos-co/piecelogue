/**
 * Pull side of automatic sync.
 *
 * One pass = fetch the cloud library (including tombstones) -> merge metadata
 * into IndexedDB -> download any images this device is missing -> re-queue
 * uploads for local images the cloud is missing.
 *
 * Full-library snapshot is used deliberately: libraries are small, and the
 * boundary here is the seam to swap for /api/cloud/sync?cursor=... later
 * without touching the coordinator, the merge logic, or local persistence.
 */

import { fetchCloudLibrary, downloadCloudArtworkImage } from '../api/cloud.js'
import { mergeCloudLibrary } from '../db/mergeService.js'
import { saveRestoredArtworkImage } from '../db/restoreService.js'
import { setImageHashes } from '../db/syncImageHashService.js'
import { setLastSyncedAt } from '../db/syncStateService.js'
import { hasStoredImageBytes } from '../db/artworkImageStorage.js'
import { readArtworkImageBytes } from '../db/artworkImageReader.js'
import { IMAGE_KINDS } from '../db/artworkImageKeys.js'
import { hashBytes } from './imageHash.js'
import { planImageSyncSteps } from './mergeLogic.js'
import { reconcileIncompleteCloudImages } from './reconcileIncompleteCloudImages.js'

const MAX_IMAGE_DOWNLOAD_CONCURRENCY = 2

function emptySummary() {
  return { imported: 0, applied: 0, deleted: 0, conflicts: 0, unchanged: 0, keptLocal: 0 }
}

async function runWithConcurrency(items, limit, handler) {
  const queue = [...items]
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()
      if (item) {
        await handler(item)
      }
    }
  })
  await Promise.all(workers)
}

/**
 * Perform one pull pass.
 *
 * @returns {{changed:boolean, folders:object, artworks:object, downloaded:number, downloadFailures:number}}
 */
export async function pullAndMerge({ userId, deps = {} } = {}) {
  // Every cloud endpoint here is authenticated. Never issue a request without
  // an active user, so a signed-out or mid-logout cycle cannot touch them.
  if (!userId) {
    return {
      changed: false,
      skipped: 'signed-out',
      folders: emptySummary(),
      artworks: emptySummary(),
      downloaded: 0,
      downloadFailures: 0,
      requeued: 0,
    }
  }

  const fetchLibrary = deps.fetchLibrary ?? fetchCloudLibrary
  const downloadImage = deps.downloadImage ?? downloadCloudArtworkImage
  const saveImage = deps.saveImage ?? saveRestoredArtworkImage

  const library = await fetchLibrary({ includeDeleted: true })

  // Folders first so artwork.folderId always points at a row that exists.
  const folders = await mergeCloudLibrary(library, { userId, entityType: 'folder' })
  const artworks = await mergeCloudLibrary(library, { userId, entityType: 'artwork' })

  // Images: only fetch what this device does not already hold.
  const steps = await planImageSyncSteps(library.artworks ?? [], {
    hasOriginal: async (id) => hasStoredImageBytes(id, IMAGE_KINDS.ORIGINAL),
    hasThumbnail: async (id) => hasStoredImageBytes(id, IMAGE_KINDS.THUMBNAIL),
  })

  const hashesByArtwork = new Map()
  let downloaded = 0
  let downloadFailures = 0

  await runWithConcurrency(steps, MAX_IMAGE_DOWNLOAD_CONCURRENCY, async (step) => {
    try {
      const blob = await downloadImage(step.artworkId, step.type)
      await saveImage(step.artworkId, step.type, blob)

      const kind =
        step.type === 'thumbnail' ? IMAGE_KINDS.THUMBNAIL : IMAGE_KINDS.ORIGINAL
      const read = await readArtworkImageBytes(step.artworkId, kind)
      if (read.ok) {
        const entry = hashesByArtwork.get(step.artworkId) || {}
        if (step.type === 'thumbnail') {
          entry.thumbnailHash = await hashBytes(read.bytes)
        } else {
          entry.originalHash = await hashBytes(read.bytes)
        }
        hashesByArtwork.set(step.artworkId, entry)
      }
      downloaded += 1
    } catch {
      // A failed image download must never abort the metadata merge, and must
      // never clear healthy local bytes.
      downloadFailures += 1
    }
  })

  if (userId) {
    for (const [artworkId, hashes] of hashesByArtwork) {
      await setImageHashes(userId, artworkId, hashes)
    }
    await setLastSyncedAt(userId)
  }

  // Re-queue uploads for local images the cloud does not have.
  let requeued = 0
  if (userId) {
    try {
      const incomplete = await reconcileIncompleteCloudImages(userId, {
        force: true,
        fetchLibrary: async () => library,
      })
      requeued = incomplete?.length ?? 0
    } catch {
      // Best-effort; the processor will retry on its own schedule.
    }
  }

  const changed =
    folders.imported +
      folders.applied +
      folders.deleted +
      folders.conflicts +
      artworks.imported +
      artworks.applied +
      artworks.deleted +
      artworks.conflicts +
      downloaded >
    0

  return {
    changed,
    folders,
    artworks,
    downloaded,
    downloadFailures,
    requeued,
  }
}