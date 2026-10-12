import { fetchCloudLibrary } from '../api/cloud.js'
import * as artworkService from '../db/artworkService.js'
import { IMAGE_KINDS } from '../db/artworkImageKeys.js'
import {
  clearImageRecoveryRequired,
  deleteOrphanRecoveryImageRecords,
  hasStoredImageBytes,
  markImageRecoveryRequired,
} from '../db/artworkImageStorage.js'
import { clearImageHashes } from '../db/syncImageHashService.js'
import { enqueueSyncJob, getSyncJobsForUser } from '../db/syncQueueService.js'
import { filterRepairableEntries } from '../utils/repairEntries.js'
import { SYNC_ENTITY_TYPES } from './constants.js'
import {
  findIncompleteCloudArtworks,
  shouldReportIncompleteCloudImages,
} from './incompleteCloudImages.js'

let cachedIncompleteCloudImages = []
let lastReconcileAt = 0

const RECONCILE_MIN_INTERVAL_MS = 15_000

export function getCachedIncompleteCloudImages() {
  return cachedIncompleteCloudImages
}

export function setCachedIncompleteCloudImages(entries = []) {
  cachedIncompleteCloudImages = entries
}

export function resetIncompleteCloudImageCache() {
  cachedIncompleteCloudImages = []
  lastReconcileAt = 0
}

async function enqueueMissingImageUpload(userId, artworkId) {
  await clearImageHashes(userId, artworkId)
  await enqueueSyncJob(userId, SYNC_ENTITY_TYPES.ARTWORK_IMAGE, artworkId)
}

/**
 * Compare cloud library image flags with local durable bytes.
 * Re-queues uploads when local bytes exist; marks recovery when they do not.
 *
 * Tombstones and artwork with no local row are excluded: the user cannot
 * re-select an image for artwork that no longer exists, so they must never
 * become image-repair work.
 */
export async function reconcileIncompleteCloudImages(userId, options = {}) {
  if (!userId) {
    setCachedIncompleteCloudImages([])
    return []
  }

  const now = options.now ?? Date.now()
  if (!options.force && now - lastReconcileAt < RECONCILE_MIN_INTERVAL_MS) {
    return cachedIncompleteCloudImages
  }

  const fetchLibrary = options.fetchLibrary ?? fetchCloudLibrary
  const library = await fetchLibrary()

  // The pull path fetches tombstones on purpose; drop them before comparing
  // images so a deleted cloud row never manufactures repair work.
  const liveCloudArtworks = (library.artworks || []).filter((artwork) => !artwork.deletedAt)
  const cloudIncomplete = findIncompleteCloudArtworks(liveCloudArtworks)

  // Only artwork that still exists locally is repairable.
  const localArtworks = await artworkService.getAllArtworks()
  const localById = new Map(localArtworks.map((artwork) => [artwork.id, artwork]))
  const incomplete = filterRepairableEntries(
    cloudIncomplete,
    new Set(localById.keys()),
  )

  setCachedIncompleteCloudImages(incomplete)
  lastReconcileAt = now

  for (const entry of incomplete) {
    // Probe raw byte presence, not the verified flag: an image that is flagged
    // but still intact must be re-queued for upload, not re-flagged forever.
    const hasOriginal = await hasStoredImageBytes(entry.artworkId, IMAGE_KINDS.ORIGINAL)
    const hasThumbnail = await hasStoredImageBytes(entry.artworkId, IMAGE_KINDS.THUMBNAIL)

    if (entry.missingOriginal || entry.missingThumbnail) {
      if ((entry.missingOriginal && hasOriginal) || (entry.missingThumbnail && (hasThumbnail || hasOriginal))) {
        await clearImageRecoveryRequired(entry.artworkId, IMAGE_KINDS.ORIGINAL)
        await clearImageRecoveryRequired(entry.artworkId, IMAGE_KINDS.THUMBNAIL)
        await enqueueMissingImageUpload(userId, entry.artworkId)
        continue
      }

      if (entry.missingOriginal && !hasOriginal) {
        await markImageRecoveryRequired(entry.artworkId, IMAGE_KINDS.ORIGINAL, 'cloud_incomplete')
      }
      if (entry.missingThumbnail && !hasThumbnail && !hasOriginal) {
        await markImageRecoveryRequired(entry.artworkId, IMAGE_KINDS.THUMBNAIL, 'cloud_incomplete')
      }
    }
  }

  // Durable rows left behind for artwork that no longer exists locally cannot
  // be repaired. Remove them so a stale pass cannot resurrect warnings.
  await deleteOrphanRecoveryImageRecords()

  // Titles come from the live local row, never from a deleted cloud record.
  setCachedIncompleteCloudImages(
    incomplete.map((entry) => ({
      ...entry,
      title: localById.get(entry.artworkId)?.title || entry.title,
    })),
  )

  return cachedIncompleteCloudImages
}

export async function hasPendingArtworkImageJobs(userId) {
  if (!userId) {
    return false
  }
  const jobs = await getSyncJobsForUser(userId)
  return jobs.some(
    (job) =>
      job.entityType === SYNC_ENTITY_TYPES.ARTWORK_IMAGE &&
      (job.status === 'pending' || job.status === 'processing'),
  )
}

export async function getIncompleteCloudStatusPayload(userId) {
  const localArtworks = await artworkService.getAllArtworks()
  const liveIds = new Set(localArtworks.map((artwork) => artwork.id))
  const incomplete = filterRepairableEntries(
    getCachedIncompleteCloudImages(),
    liveIds,
  )
  const hasPendingImageJobs = await hasPendingArtworkImageJobs(userId)
  if (!shouldReportIncompleteCloudImages(incomplete, { hasPendingImageJobs })) {
    return null
  }
  return incomplete
}
