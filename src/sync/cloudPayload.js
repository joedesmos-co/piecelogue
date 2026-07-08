export function toCloudArtworkMetadata(artwork, { baseRevision, force = false } = {}) {
  return {
    id: artwork.id,
    folderId: artwork.folderId ?? null,
    title: artwork.title,
    mediumType: artwork.mediumType,
    medium: artwork.medium ?? '',
    status: artwork.status,
    hours: artwork.hours ?? 0,
    minutes: artwork.minutes ?? 0,
    totalMinutes: artwork.totalMinutes ?? 0,
    artworkDate: artwork.artworkDate ?? null,
    notes: artwork.notes ?? '',
    favorite: Boolean(artwork.favorite),
    createdAt: artwork.createdAt,
    updatedAt: artwork.updatedAt,
    baseRevision: baseRevision ?? artwork.cloudRevision ?? 0,
    ...(force ? { force: true } : {}),
  }
}

export function toCloudFolder(folder, { baseRevision, force = false } = {}) {
  return {
    id: folder.id,
    name: folder.name,
    parentFolderId: folder.parentFolderId ?? null,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
    baseRevision: baseRevision ?? folder.cloudRevision ?? 0,
    ...(force ? { force: true } : {}),
  }
}
