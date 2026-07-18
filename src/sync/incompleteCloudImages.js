/**
 * Pure helpers for detecting D1 artwork metadata that is missing R2 images.
 */

export function isCloudArtworkImageIncomplete(cloudArtwork) {
  if (!cloudArtwork) {
    return false
  }
  return !cloudArtwork.hasOriginal || !cloudArtwork.hasThumbnail
}

export function findIncompleteCloudArtworks(cloudArtworks = []) {
  return cloudArtworks
    .filter((artwork) => isCloudArtworkImageIncomplete(artwork))
    .map((artwork) => ({
      artworkId: artwork.id,
      title: artwork.title || 'Untitled artwork',
      hasOriginal: Boolean(artwork.hasOriginal),
      hasThumbnail: Boolean(artwork.hasThumbnail),
      missingOriginal: !artwork.hasOriginal,
      missingThumbnail: !artwork.hasThumbnail,
    }))
}

export function describeIncompleteCloudArtwork(entry) {
  if (!entry) {
    return 'Image upload incomplete.'
  }

  if (entry.missingOriginal && entry.missingThumbnail) {
    return `${entry.title}: original and thumbnail images are missing from cloud.`
  }
  if (entry.missingOriginal) {
    return `${entry.title}: original image is missing from cloud.`
  }
  if (entry.missingThumbnail) {
    return `${entry.title}: thumbnail image is missing from cloud.`
  }
  return `${entry.title}: image upload incomplete.`
}

export function shouldReportIncompleteCloudImages(incomplete = [], options = {}) {
  if (!incomplete.length) {
    return false
  }
  // While uploads are actively queued/processing, prefer syncing/pending states.
  if (options.hasPendingImageJobs) {
    return false
  }
  return true
}

export function buildIncompleteCloudSyncStatus(incomplete = []) {
  if (!incomplete.length) {
    return null
  }

  const first = incomplete[0]
  return {
    state: 'image_upload_incomplete',
    label: 'Image upload incomplete',
    description:
      incomplete.length === 1
        ? describeIncompleteCloudArtwork(first)
        : `${incomplete.length} artworks are missing cloud images. ${describeIncompleteCloudArtwork(first)}`,
    incompleteCloudImages: incomplete,
  }
}
