import { IMAGE_EXTENSION_BY_TYPE } from './constants.js'
import { nowIso } from '../auth/tokens.js'

export const CLOUD_LIBRARY_ACTIVE_FILTER = 'deleted_at IS NULL'

export function getOriginalObjectKey(userId, artworkId, contentType) {
  const extension = IMAGE_EXTENSION_BY_TYPE[contentType] || 'bin'
  return `users/${userId}/artworks/${artworkId}/original.${extension}`
}

export function getThumbnailObjectKey(userId, artworkId) {
  return `users/${userId}/artworks/${artworkId}/thumbnail.jpg`
}

function normalizeFolder(folder) {
  const name = typeof folder.name === 'string' ? folder.name.trim() : ''
  if (!name) {
    throw new Error('Folder name is required.')
  }

  return {
    id: folder.id,
    name,
    parentFolderId: normalizeParentFolderId(folder.parentFolderId),
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt || folder.createdAt || nowIso(),
  }
}

function normalizeParentFolderId(parentFolderId) {
  if (parentFolderId === '' || parentFolderId === undefined) {
    return null
  }
  return parentFolderId
}

function normalizeArtworkMetadata(artwork) {
  const title = typeof artwork.title === 'string' ? artwork.title.trim() : ''
  if (!title) {
    throw new Error('Artwork title is required.')
  }

  return {
    id: artwork.id,
    folderId: artwork.folderId ?? null,
    title,
    mediumType: artwork.mediumType || 'Other',
    medium: artwork.medium || '',
    status: artwork.status || 'In Progress',
    hours: Math.max(0, Number(artwork.hours) || 0),
    minutes: Math.max(0, Math.min(59, Number(artwork.minutes) || 0)),
    totalMinutes: Math.max(0, Number(artwork.totalMinutes) || 0),
    artworkDate: artwork.artworkDate || null,
    notes: artwork.notes || '',
    favorite: artwork.favorite ? 1 : 0,
    createdAt: artwork.createdAt,
    updatedAt: artwork.updatedAt || artwork.createdAt || nowIso(),
  }
}

export async function upsertCloudFolders(db, userId, folders) {
  if (!Array.isArray(folders)) {
    throw new Error('folders must be an array.')
  }

  let saved = 0

  for (const rawFolder of folders) {
    const folder = normalizeFolder(rawFolder)
    const existing = await db
      .prepare('SELECT id, user_id FROM folders WHERE id = ?')
      .bind(folder.id)
      .first()

    if (existing && existing.user_id !== userId) {
      throw new Error('Folder id is already used by another account.')
    }

    if (existing) {
      await db
        .prepare(
          `UPDATE folders
           SET name = ?, parent_folder_id = ?, updated_at = ?, deleted_at = NULL
           WHERE id = ? AND user_id = ?`,
        )
        .bind(folder.name, folder.parentFolderId, folder.updatedAt, folder.id, userId)
        .run()
    } else {
      await db
        .prepare(
          `INSERT INTO folders (id, user_id, name, parent_folder_id, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL)`,
        )
        .bind(
          folder.id,
          userId,
          folder.name,
          folder.parentFolderId,
          folder.createdAt,
          folder.updatedAt,
        )
        .run()
    }

    saved += 1
  }

  return { saved }
}

export async function upsertCloudArtworks(db, userId, artworks) {
  if (!Array.isArray(artworks)) {
    throw new Error('artworks must be an array.')
  }

  let saved = 0

  for (const rawArtwork of artworks) {
    const artwork = normalizeArtworkMetadata(rawArtwork)
    const existing = await db
      .prepare(
        `SELECT id, user_id, original_object_key, thumbnail_object_key
         FROM artworks
         WHERE id = ?`,
      )
      .bind(artwork.id)
      .first()

    if (existing && existing.user_id !== userId) {
      throw new Error('Artwork id is already used by another account.')
    }

    if (existing) {
      await db
        .prepare(
          `UPDATE artworks
           SET folder_id = ?,
               title = ?,
               medium_type = ?,
               medium = ?,
               status = ?,
               hours = ?,
               minutes = ?,
               total_minutes = ?,
               artwork_date = ?,
               notes = ?,
               favorite = ?,
               updated_at = ?,
               deleted_at = NULL
           WHERE id = ? AND user_id = ?`,
        )
        .bind(
          artwork.folderId,
          artwork.title,
          artwork.mediumType,
          artwork.medium,
          artwork.status,
          artwork.hours,
          artwork.minutes,
          artwork.totalMinutes,
          artwork.artworkDate,
          artwork.notes,
          artwork.favorite,
          artwork.updatedAt,
          artwork.id,
          userId,
        )
        .run()
    } else {
      await db
        .prepare(
          `INSERT INTO artworks (
             id, user_id, folder_id, title, medium_type, medium, status,
             hours, minutes, total_minutes, artwork_date, notes, favorite,
             original_object_key, thumbnail_object_key,
             created_at, updated_at, deleted_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL)`,
        )
        .bind(
          artwork.id,
          userId,
          artwork.folderId,
          artwork.title,
          artwork.mediumType,
          artwork.medium,
          artwork.status,
          artwork.hours,
          artwork.minutes,
          artwork.totalMinutes,
          artwork.artworkDate,
          artwork.notes,
          artwork.favorite,
          artwork.createdAt,
          artwork.updatedAt,
        )
        .run()
    }

    saved += 1
  }

  return { saved }
}

export function getArtworkObjectKeys(row) {
  if (!row) {
    return []
  }

  return [row.original_object_key, row.thumbnail_object_key].filter(Boolean)
}

export async function softDeleteCloudFolder(db, userId, folderId) {
  const row = await db
    .prepare('SELECT id, user_id, deleted_at FROM folders WHERE id = ?')
    .bind(folderId)
    .first()

  if (!row || row.user_id !== userId) {
    return null
  }

  if (row.deleted_at) {
    return { alreadyDeleted: true, deletedAt: row.deleted_at }
  }

  const deletedAt = nowIso()
  await db
    .prepare(
      `UPDATE folders
       SET deleted_at = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    )
    .bind(deletedAt, deletedAt, folderId, userId)
    .run()

  return { deletedAt }
}

export async function softDeleteCloudArtwork(db, bucket, userId, artworkId) {
  const row = await db
    .prepare(
      `SELECT id, user_id, deleted_at, original_object_key, thumbnail_object_key
       FROM artworks
       WHERE id = ?`,
    )
    .bind(artworkId)
    .first()

  if (!row || row.user_id !== userId) {
    return null
  }

  if (row.deleted_at) {
    return { alreadyDeleted: true, deletedAt: row.deleted_at, r2Deleted: 0 }
  }

  const objectKeys = getArtworkObjectKeys(row)
  const deletedAt = nowIso()

  await db
    .prepare(
      `UPDATE artworks
       SET deleted_at = ?,
           updated_at = ?,
           original_object_key = NULL,
           thumbnail_object_key = NULL
       WHERE id = ? AND user_id = ?`,
    )
    .bind(deletedAt, deletedAt, artworkId, userId)
    .run()

  let r2Deleted = 0
  if (bucket && objectKeys.length > 0) {
    for (const objectKey of objectKeys) {
      try {
        await bucket.delete(objectKey)
        r2Deleted += 1
      } catch {
        // R2 cleanup is best-effort after D1 tombstone is set.
      }
    }
  }

  return { deletedAt, r2Deleted }
}

export async function assertArtworkOwnedByUser(db, userId, artworkId) {
  const row = await db
    .prepare(
      'SELECT id, user_id FROM artworks WHERE id = ? AND deleted_at IS NULL',
    )
    .bind(artworkId)
    .first()

  if (!row || row.user_id !== userId) {
    return null
  }

  return row
}

export async function saveArtworkOriginal(db, bucket, userId, artworkId, body, contentType) {
  const objectKey = getOriginalObjectKey(userId, artworkId, contentType)

  await bucket.put(objectKey, body, {
    httpMetadata: { contentType },
  })

  const updatedAt = nowIso()
  await db
    .prepare(
      `UPDATE artworks
       SET original_object_key = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    )
    .bind(objectKey, updatedAt, artworkId, userId)
    .run()

  return { objectKey, updatedAt }
}

export async function saveArtworkThumbnail(db, bucket, userId, artworkId, body, contentType) {
  const objectKey = getThumbnailObjectKey(userId, artworkId)

  await bucket.put(objectKey, body, {
    httpMetadata: { contentType: contentType || 'image/jpeg' },
  })

  const updatedAt = nowIso()
  await db
    .prepare(
      `UPDATE artworks
       SET thumbnail_object_key = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    )
    .bind(objectKey, updatedAt, artworkId, userId)
    .run()

  return { objectKey, updatedAt }
}

export function mapCloudFolderRow(row) {
  return {
    id: row.id,
    name: row.name,
    parentFolderId: row.parent_folder_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapCloudArtworkRow(row) {
  return {
    id: row.id,
    folderId: row.folder_id ?? null,
    title: row.title,
    mediumType: row.medium_type || 'Other',
    medium: row.medium || '',
    status: row.status || 'In Progress',
    hours: row.hours ?? 0,
    minutes: row.minutes ?? 0,
    totalMinutes: row.total_minutes ?? 0,
    artworkDate: row.artwork_date ?? null,
    notes: row.notes || '',
    favorite: Boolean(row.favorite),
    hasOriginal: Boolean(row.original_object_key),
    hasThumbnail: Boolean(row.thumbnail_object_key),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getCloudLibrary(db, userId) {
  const folderResult = await db
    .prepare(
      `SELECT id, name, parent_folder_id, created_at, updated_at
       FROM folders
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY created_at`,
    )
    .bind(userId)
    .all()

  const artworkResult = await db
    .prepare(
      `SELECT id, folder_id, title, medium_type, medium, status,
              hours, minutes, total_minutes, artwork_date, notes, favorite,
              original_object_key, thumbnail_object_key, created_at, updated_at
       FROM artworks
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY created_at`,
    )
    .bind(userId)
    .all()

  return {
    folders: (folderResult?.results ?? []).map(mapCloudFolderRow),
    artworks: (artworkResult?.results ?? []).map(mapCloudArtworkRow),
  }
}

export async function getArtworkImageObject(db, bucket, userId, artworkId, imageType) {
  const row = await db
    .prepare(
      `SELECT user_id, original_object_key, thumbnail_object_key
       FROM artworks
       WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(artworkId)
    .first()

  if (!row || row.user_id !== userId) {
    return null
  }

  const objectKey =
    imageType === 'thumbnail' ? row.thumbnail_object_key : row.original_object_key
  if (!objectKey) {
    return null
  }

  return bucket.get(objectKey)
}

export async function getCloudStatus(db, userId) {
  const folderCount = await db
    .prepare('SELECT COUNT(*) AS count FROM folders WHERE user_id = ? AND deleted_at IS NULL')
    .bind(userId)
    .first()

  const artworkStats = await db
    .prepare(
      `SELECT
         COUNT(*) AS artwork_count,
         SUM(CASE WHEN original_object_key IS NOT NULL THEN 1 ELSE 0 END) AS with_original_count,
         SUM(CASE WHEN thumbnail_object_key IS NOT NULL THEN 1 ELSE 0 END) AS with_thumbnail_count,
         MAX(updated_at) AS last_saved_at
       FROM artworks
       WHERE user_id = ? AND deleted_at IS NULL`,
    )
    .bind(userId)
    .first()

  return {
    folderCount: folderCount?.count ?? 0,
    artworkCount: artworkStats?.artwork_count ?? 0,
    artworkWithOriginalCount: artworkStats?.with_original_count ?? 0,
    artworkWithThumbnailCount: artworkStats?.with_thumbnail_count ?? 0,
    lastSavedAt: artworkStats?.last_saved_at ?? null,
  }
}
