export function normalizeBaseRevision(value) {
  const revision = Number(value)
  if (!Number.isFinite(revision) || revision < 0) {
    return 0
  }
  return Math.floor(revision)
}

export function getCloudRevision(row) {
  if (!row) {
    return 0
  }
  const revision = Number(row.revision ?? row.cloudRevision)
  if (!Number.isFinite(revision) || revision < 1) {
    return 1
  }
  return Math.floor(revision)
}

export function evaluateRevisionConflict(existing, baseRevision, { force = false } = {}) {
  if (force) {
    return null
  }

  const base = normalizeBaseRevision(baseRevision)

  if (!existing || existing.deleted_at) {
    return null
  }

  const cloudRevision = getCloudRevision(existing)

  if (base === 0) {
    return {
      cloudRevision,
      reason: 'cloud_changed_since_last_sync',
    }
  }

  if (base !== cloudRevision) {
    return {
      cloudRevision,
      reason: 'stale_revision',
    }
  }

  return null
}

export function buildConflictRecord({
  id,
  baseRevision,
  cloudRevision,
  cloud,
  reason,
}) {
  return {
    id,
    baseRevision: normalizeBaseRevision(baseRevision),
    cloudRevision,
    reason: reason || 'stale_revision',
    cloud,
  }
}

export function summarizeFolderConflict(local, cloud) {
  return {
    title: local?.name || cloud?.name || 'Folder',
    localSummary: local?.name || '—',
    cloudSummary: cloud?.name || '—',
    localParent: local?.parentFolderId ?? null,
    cloudParent: cloud?.parentFolderId ?? null,
  }
}

export function summarizeArtworkConflict(local, cloud) {
  return {
    title: local?.title || cloud?.title || 'Artwork',
    localSummary: [local?.title, local?.status, local?.medium].filter(Boolean).join(' · '),
    cloudSummary: [cloud?.title, cloud?.status, cloud?.medium].filter(Boolean).join(' · '),
  }
}

export function snapshotFolder(folder) {
  if (!folder) {
    return null
  }
  return {
    id: folder.id,
    name: folder.name,
    parentFolderId: folder.parentFolderId ?? null,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
    cloudRevision: normalizeBaseRevision(folder.cloudRevision),
  }
}

export function snapshotArtwork(artwork) {
  if (!artwork) {
    return null
  }
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
    cloudRevision: normalizeBaseRevision(artwork.cloudRevision),
  }
}
