export function toCloudArtworkMetadata(
  artwork,
  { baseRevision, force = false, allowResurrect = false } = {},
) {
  const unknown = Boolean(artwork.durationUnknown) || artwork.totalMinutes == null
  return {
    id: artwork.id,
    folderId: artwork.folderId ?? null,
    title: artwork.title,
    mediumType: artwork.mediumType,
    medium: artwork.medium ?? '',
    status: artwork.status,
    hours: unknown ? 0 : (artwork.hours ?? 0),
    minutes: unknown ? 0 : (artwork.minutes ?? 0),
    totalMinutes: unknown ? 0 : (artwork.totalMinutes ?? 0),
    durationUnknown: unknown,
    artworkDate: artwork.artworkDate ?? null,
    notes: artwork.notes ?? '',
    favorite: Boolean(artwork.favorite),
    createdAt: artwork.createdAt,
    updatedAt: artwork.updatedAt,
    baseRevision: baseRevision ?? artwork.cloudRevision ?? 0,
    ...(force ? { force: true } : {}),
    // Deliberately opt-in: only an explicit "Restore" may revive a tombstone.
    ...(allowResurrect ? { allowResurrect: true } : {}),
  }
}

export function toCloudFolder(
  folder,
  { baseRevision, force = false, allowResurrect = false } = {},
) {
  return {
    id: folder.id,
    name: folder.name,
    parentFolderId: folder.parentFolderId ?? null,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
    baseRevision: baseRevision ?? folder.cloudRevision ?? 0,
    ...(force ? { force: true } : {}),
    ...(allowResurrect ? { allowResurrect: true } : {}),
  }
}
