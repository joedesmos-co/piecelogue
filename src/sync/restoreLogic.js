export function toLocalFolder(cloudFolder) {
  return {
    id: cloudFolder.id,
    name: cloudFolder.name,
    parentFolderId: cloudFolder.parentFolderId ?? null,
    createdAt: cloudFolder.createdAt,
    updatedAt: cloudFolder.updatedAt,
  }
}

export function toLocalArtworkMetadata(cloudArtwork) {
  return {
    id: cloudArtwork.id,
    folderId: cloudArtwork.folderId ?? null,
    title: cloudArtwork.title,
    mediumType: cloudArtwork.mediumType || 'Other',
    medium: cloudArtwork.medium ?? '',
    status: cloudArtwork.status || 'In Progress',
    hours: cloudArtwork.hours ?? 0,
    minutes: cloudArtwork.minutes ?? 0,
    totalMinutes: cloudArtwork.totalMinutes ?? 0,
    artworkDate: cloudArtwork.artworkDate ?? null,
    notes: cloudArtwork.notes ?? '',
    favorite: Boolean(cloudArtwork.favorite),
    createdAt: cloudArtwork.createdAt,
    updatedAt: cloudArtwork.updatedAt,
  }
}

export function buildImageDownloadSteps(cloudArtworks) {
  const steps = []

  for (const artwork of cloudArtworks) {
    if (artwork.hasOriginal) {
      steps.push({ artworkId: artwork.id, title: artwork.title, type: 'original' })
    }
    if (artwork.hasThumbnail) {
      steps.push({ artworkId: artwork.id, title: artwork.title, type: 'thumbnail' })
    }
  }

  return steps
}

export function cloudLibraryHasData(status) {
  return (status?.folderCount ?? 0) + (status?.artworkCount ?? 0) > 0
}

export function localLibraryIsEmpty(counts) {
  return (counts?.folderCount ?? 0) + (counts?.artworkCount ?? 0) === 0
}

export function decideRestoreAction({ localCounts, cloudStatus, restoreDismissed }) {
  if (!cloudLibraryHasData(cloudStatus)) {
    return 'none'
  }
  if (localLibraryIsEmpty(localCounts)) {
    return 'auto-restore'
  }
  return restoreDismissed ? 'none' : 'prompt'
}
