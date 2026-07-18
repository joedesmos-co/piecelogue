import { fetchCloudLibrary } from '../api/cloud.js'
import * as artworkService from '../db/artworkService.js'
import { IMAGE_KINDS } from '../db/artworkImageKeys.js'
import {
  clearImageRecoveryRequired,
  hasVerifiedDurableImage,
  markImageRecoveryRequired,
} from '../db/artworkImageStorage.js'
import { clearImageHashes } from '../db/syncImageHashService.js'
import { enqueueSyncJob, getSyncJobsForUser } from '../db/syncQueueService.js'
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
  const incomplete = findIncompleteCloudArtworks(library.artworks || [])
  setCachedIncompleteCloudImages(incomplete)
  lastReconcileAt = now

  for (const entry of incomplete) {
    const hasOriginal = await hasVerifiedDurableImage(entry.artworkId, IMAGE_KINDS.ORIGINAL)
    const hasThumbnail = await hasVerifiedDurableImage(entry.artworkId, IMAGE_KINDS.THUMBNAIL)

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

  // Refresh titles from local metadata when available.
  const localArtworks = await artworkService.getAllArtworks()
  const titleById = new Map(localArtworks.map((artwork) => [artwork.id, artwork.title]))
  setCachedIncompleteCloudImages(
    incomplete.map((entry) => ({
      ...entry,
      title: titleById.get(entry.artworkId) || entry.title,
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
  const incomplete = getCachedIncompleteCloudImages()
  const hasPendingImageJobs = await hasPendingArtworkImageJobs(userId)
  if (!shouldReportIncompleteCloudImages(incomplete, { hasPendingImageJobs })) {
    return null
  }
  return incomplete
}
