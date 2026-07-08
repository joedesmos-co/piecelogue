import { downloadCloudArtworkImage, uploadCloudArtworks, uploadCloudFolders } from '../api/cloud.js'
import { db } from '../db/database.js'
import {
  saveRestoredArtworkImage,
  upsertRestoredArtworkMetadata,
  upsertRestoredFolders,
} from '../db/restoreService.js'
import { removeSyncConflict } from '../db/syncConflictService.js'
import { removeSyncJob } from '../db/syncQueueService.js'
import { setArtworkCloudRevision, setFolderCloudRevision } from '../db/syncRevisionService.js'
import { setImageHashes } from '../db/syncImageHashService.js'
import { toCloudArtworkMetadata, toCloudFolder } from './cloudPayload.js'
import { SYNC_ENTITY_TYPES } from './constants.js'
import { hashBlob } from './imageHash.js'
import {
  extractUpsertRevision,
  localArtworkFromCloud,
  localFolderFromCloud,
} from './conflictResolutionCore.js'

async function downloadCloudArtworkImages(userId, artworkId, cloud) {
  const hashes = {}

  if (cloud.hasOriginal) {
    const blob = await downloadCloudArtworkImage(artworkId, 'original')
    await saveRestoredArtworkImage(artworkId, 'original', blob)
    hashes.originalHash = await hashBlob(blob)
  }

  if (cloud.hasThumbnail) {
    const blob = await downloadCloudArtworkImage(artworkId, 'thumbnail')
    await saveRestoredArtworkImage(artworkId, 'thumbnail', blob)
    hashes.thumbnailHash = await hashBlob(blob)
  }

  if (userId && (hashes.originalHash || hashes.thumbnailHash)) {
    await setImageHashes(userId, artworkId, hashes)
  }
}

export async function resolveKeepLocal(conflict) {
  const { userId, entityType, entityId, jobId } = conflict

  if (entityType === SYNC_ENTITY_TYPES.FOLDER) {
    const folder = await db.folders.get(entityId)
    if (!folder) {
      throw new Error('Local folder not found.')
    }

    const response = await uploadCloudFolders([toCloudFolder(folder, { force: true })])
    const revision = extractUpsertRevision(response, entityId)
    if (revision) {
      await setFolderCloudRevision(entityId, revision)
    }
  } else if (entityType === SYNC_ENTITY_TYPES.ARTWORK) {
    const artwork = await db.artworks.get(entityId)
    if (!artwork) {
      throw new Error('Local artwork not found.')
    }

    const response = await uploadCloudArtworks([toCloudArtworkMetadata(artwork, { force: true })])
    const revision = extractUpsertRevision(response, entityId)
    if (revision) {
      await setArtworkCloudRevision(entityId, revision)
    }
  } else {
    throw new Error('Unsupported conflict type.')
  }

  await removeSyncConflict(userId, entityType, entityId)
  if (jobId) {
    await removeSyncJob(jobId)
  }
}

export async function resolveKeepCloud(conflict) {
  const { userId, entityType, entityId, jobId, cloud } = conflict
  if (!cloud) {
    throw new Error('Cloud version missing from conflict record.')
  }

  if (entityType === SYNC_ENTITY_TYPES.FOLDER) {
    await upsertRestoredFolders([localFolderFromCloud(cloud)])
  } else if (entityType === SYNC_ENTITY_TYPES.ARTWORK) {
    await upsertRestoredArtworkMetadata(localArtworkFromCloud(cloud))
    await downloadCloudArtworkImages(userId, entityId, cloud)
  } else {
    throw new Error('Unsupported conflict type.')
  }

  await removeSyncConflict(userId, entityType, entityId)
  if (jobId) {
    await removeSyncJob(jobId)
  }
}
