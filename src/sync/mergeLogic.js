/**
 * Pure merge decisions for the pull side of sync.
 *
 * Cloud must never blindly overwrite newer local data. These helpers are pure
 * so every rule below is directly testable without IndexedDB or network.
 *
 * Terminology:
 *   local.cloudRevision - the revision this device last successfully synced.
 *                        0 means "never synced" (locally created).
 *   remote.revision     - the revision currently stored in D1.
 *   localDirty          - this device has changes the cloud has not accepted.
 */

export const MERGE_ACTION = {
  IMPORT: 'import',
  APPLY_REMOTE: 'apply-remote',
  APPLY_DELETE: 'apply-delete',
  KEEP_LOCAL: 'keep-local',
  NOOP: 'noop',
  CONFLICT: 'conflict',
}

export function normalizeRevision(value) {
  const revision = Number(value)
  if (!Number.isFinite(revision) || revision < 0) {
    return 0
  }
  return Math.floor(revision)
}

/**
 * Decide what to do with one artwork or folder given its local and remote state.
 *
 * @param {object}  input
 * @param {object|null} input.local    - local Dexie record, or null when absent
 * @param {object}  input.remote       - cloud record (may carry deletedAt)
 * @param {boolean} input.localDirty   - local has unsynced changes
 * @param {boolean} input.allowResurrect - opt-in to reviving a deleted entity
 */
export function decideMergeAction({ local, remote, localDirty = false, allowResurrect = false }) {
  const remoteRevision = normalizeRevision(remote?.revision)
  const isRemoteDeleted = Boolean(remote?.deletedAt)

  // REMOTE ONLY -> import into IndexedDB.
  if (!local) {
    return isRemoteDeleted && !allowResurrect
      ? { action: MERGE_ACTION.NOOP }
      : { action: MERGE_ACTION.IMPORT }
  }

  const localRevision = normalizeRevision(local?.cloudRevision)

  // REMOTE TOMBSTONE
  if (isRemoteDeleted) {
    if (allowResurrect) {
      return { action: MERGE_ACTION.NOOP }
    }

    // Any unsynced local work outranks a remote tombstone, in BOTH directions:
    //
    //  - local behind the delete  -> the user edited after its last sync and
    //    another device deleted it meanwhile.
    //  - local ahead of the delete -> the tombstone is stale relative to what
    //    this device already knows, so it must not undo newer local work.
    //
    // Either way the user's edits must never be dropped just because a delete
    // exists. Surface it and let them choose.
    if (localDirty) {
      return { action: MERGE_ACTION.CONFLICT, reason: 'remote_deleted_local_changed' }
    }

    // Clean local copy: nothing to lose, so accept the remote deletion.
    // Re-applying an already-known delete is harmless and idempotent.
    return { action: MERGE_ACTION.APPLY_DELETE }
  }

  // SAME REVISION -> nothing to do.
  if (remoteRevision === localRevision) {
    return { action: MERGE_ACTION.NOOP }
  }

  // LOCAL NEWER (can happen after a local restore/import) -> keep and re-push.
  if (localRevision > remoteRevision) {
    return { action: MERGE_ACTION.KEEP_LOCAL }
  }

  // REMOTE NEWER, but this device has unsynced edits -> genuine conflict.
  if (localDirty) {
    return { action: MERGE_ACTION.CONFLICT, reason: 'both_changed' }
  }

  return { action: MERGE_ACTION.APPLY_REMOTE }
}

/**
 * True when the local record carries changes the cloud has not accepted.
 * A pending/failed/conflict outbox job is the authoritative signal; otherwise
 * a record that has never synced (cloudRevision 0) counts as dirty.
 */
export function isLocalEntityDirty(record, { pendingEntityIds = new Set() } = {}) {
  if (!record) {
    return false
  }
  if (pendingEntityIds.has(record.id)) {
    return true
  }
  return normalizeRevision(record.cloudRevision) === 0
}

/**
 * Decide which remote images this device still needs.
 *
 * Avoids re-downloading identical bytes by comparing the remote image state
 * against what this device already holds.
 */
export async function planImageSyncSteps(remoteArtworks, { hasOriginal, hasThumbnail }) {
  const steps = []

  for (const artwork of remoteArtworks) {
    if (artwork.deletedAt) {
      continue
    }

    if (artwork.hasOriginal && !(await hasOriginal(artwork.id))) {
      steps.push({ artworkId: artwork.id, title: artwork.title, type: 'original' })
    }
    if (artwork.hasThumbnail && !(await hasThumbnail(artwork.id))) {
      steps.push({ artworkId: artwork.id, title: artwork.title, type: 'thumbnail' })
    }
  }

  return steps
}

/**
 * Decide whether a cheap /api/cloud/status check implies a full library pull
 * is worth doing. Avoids fetching the whole library when nothing changed.
 */
export function shouldPullLibrary({ cloudStatus, lastSeenCloudStatus, hasPendingLocalWork }) {
  if (hasPendingLocalWork) {
    return true
  }
  if (!cloudStatus || !lastSeenCloudStatus) {
    return true
  }
  return (
    cloudStatus.folderCount !== lastSeenCloudStatus.folderCount ||
    cloudStatus.artworkCount !== lastSeenCloudStatus.artworkCount ||
    cloudStatus.artworkWithOriginalCount !== lastSeenCloudStatus.artworkWithOriginalCount ||
    cloudStatus.artworkWithThumbnailCount !== lastSeenCloudStatus.artworkWithThumbnailCount ||
    cloudStatus.lastSavedAt !== lastSeenCloudStatus.lastSavedAt
  )
}