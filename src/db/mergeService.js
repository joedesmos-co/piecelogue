/**
 * Applies pull-side merge decisions from the cloud library into IndexedDB.
 *
 * IndexedDB stays the source of truth: this only ever writes records the merge
 * logic approved, and never touches image bytes except to remove the images of
 * an entity another device explicitly deleted.
 */

import { db } from './database'
import { deleteDurableImagesForArtwork } from './artworkImageStorage'
import { getSyncJobsForUser } from './syncQueueService'
import { saveSyncConflict } from './syncConflictService'
import { setFolderCloudRevision, setArtworkCloudRevision } from './syncRevisionService'
import {
  decideMergeAction,
  isLocalEntityDirty,
  normalizeRevision,
  MERGE_ACTION,
} from '../sync/mergeLogic'
import { toLocalArtworkMetadata, toLocalFolder } from '../sync/restoreLogic'

function upsertEntityTypesFor(job) {
  if (job.entityType === 'folder' || job.entityType === 'folder-delete') {
    return 'folder'
  }
  if (job.entityType === 'artwork' || job.entityType === 'artwork-delete') {
    return 'artwork'
  }
  if (job.entityType === 'artwork-image') {
    return 'artwork'
  }
  return null
}

async function collectPendingEntityIds(userId) {
  const ids = new Set()
  if (!userId) {
    return ids
  }
  const jobs = await getSyncJobsForUser(userId)
  for (const job of jobs) {
    if (upsertEntityTypesFor(job)) {
      ids.add(job.entityId)
    }
  }
  return ids
}

function localArtworkSnapshot(artwork) {
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
    cloudRevision: normalizeRevision(artwork.cloudRevision),
  }
}

function localFolderSnapshot(folder) {
  return {
    id: folder.id,
    name: folder.name,
    parentFolderId: folder.parentFolderId ?? null,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
    cloudRevision: normalizeRevision(folder.cloudRevision),
  }
}

/**
 * Merge one cloud library into IndexedDB.
 *
 * @returns counts of what changed so callers can decide whether to refresh UI.
 */
export async function mergeCloudLibrary(library, { userId, entityType = 'artwork' } = {}) {
  const pendingIds = await collectPendingEntityIds(userId)
  const isFolder = entityType === 'folder'
  const table = isFolder ? db.folders : db.artworks
  const remotes = isFolder ? library.folders ?? [] : library.artworks ?? []

  const summary = {
    imported: 0,
    applied: 0,
    deleted: 0,
    conflicts: 0,
    unchanged: 0,
    keptLocal: 0,
  }

  for (const remote of remotes) {
    const local = await table.get(remote.id)
    const localDirty = isLocalEntityDirty(local, { pendingEntityIds: pendingIds })
    const decision = decideMergeAction({ local, remote, localDirty })

    switch (decision.action) {
      case MERGE_ACTION.IMPORT: {
        const mapped = isFolder ? toLocalFolder(remote) : toLocalArtworkMetadata(remote)
        await table.put(mapped)
        summary.imported += 1
        break
      }

      case MERGE_ACTION.APPLY_REMOTE: {
        const mapped = isFolder ? toLocalFolder(remote) : toLocalArtworkMetadata(remote)
        // Preserve any legacy inline blob fields the record already had.
        await table.put({ ...local, ...mapped })
        if (isFolder) {
          await setFolderCloudRevision(remote.id, mapped.cloudRevision)
        } else {
          await setArtworkCloudRevision(remote.id, mapped.cloudRevision)
        }
        summary.applied += 1
        break
      }

      case MERGE_ACTION.APPLY_DELETE: {
        if (isFolder) {
          // Keep artwork.folderId references intact; the merge leaves orphan
          // links alone rather than silently deleting artwork.
          await db.folders.delete(remote.id)
        } else {
          await db.transaction('rw', db.artworks, db.artworkImages, async () => {
            await deleteDurableImagesForArtwork(remote.id)
            await db.artworks.delete(remote.id)
          })
        }
        summary.deleted += 1
        break
      }

      case MERGE_ACTION.CONFLICT: {
        // Preserve the reason so the UI can distinguish "deleted on another
        // device" from a normal two-sided edit.
        await saveSyncConflict({
          userId,
          entityType,
          entityId: remote.id,
          jobId: null,
          baseRevision: normalizeRevision(local?.cloudRevision),
          cloudRevision: normalizeRevision(remote.revision),
          local: isFolder ? localFolderSnapshot(local) : localArtworkSnapshot(local),
          cloud: remote,
          reason: decision.reason,
        })
        summary.conflicts += 1
        break
      }

      case MERGE_ACTION.KEEP_LOCAL:
        summary.keptLocal += 1
        break

      case MERGE_ACTION.NOOP:
      default:
        summary.unchanged += 1
        break
    }
  }

  return summary
}