import { db } from './database'
import { generateId } from '../utils/id'
import { coalesceArtworkBlobs, getGalleryImageBlobs } from '../utils/imageUtils'
import {
  normalizeParentFolderId,
  wouldCreateFolderCycle,
} from '../utils/folderTree'
import { buildMetadataOnlyArtworkRecord } from './artworkPreservationCore'

function normalizeFolderName(name) {
  return (name || '').trim()
}

export function isDuplicateFolderName(name, folders, parentFolderId, excludeId = null) {
  const normalized = normalizeFolderName(name).toLowerCase()
  if (!normalized) return false

  const parent = normalizeParentFolderId(parentFolderId)

  return folders.some(
    (folder) =>
      folder.id !== excludeId &&
      normalizeParentFolderId(folder.parentFolderId) === parent &&
      folder.name.trim().toLowerCase() === normalized,
  )
}

function enrichFolder(folder, artworks, folders) {
  const folderArtworks = artworks
    .filter((artwork) => artwork.folderId === folder.id)
    .map(coalesceArtworkBlobs)
  const previews = folderArtworks
    .slice(0, 3)
    .map((artwork) => getGalleryImageBlobs(artwork))
  const childCount = folders.filter(
    (item) => normalizeParentFolderId(item.parentFolderId) === folder.id,
  ).length

  return {
    ...folder,
    parentFolderId: normalizeParentFolderId(folder.parentFolderId),
    count: folderArtworks.length,
    childCount,
    previews,
  }
}

async function assertValidParentFolder(parentFolderId, folders, folderId = null) {
  const parent = normalizeParentFolderId(parentFolderId)
  if (!parent) {
    return null
  }

  const parentFolder = folders.find((folder) => folder.id === parent) || (await db.folders.get(parent))
  if (!parentFolder) {
    throw new Error('Parent folder not found.')
  }

  if (folderId && wouldCreateFolderCycle(folderId, parent, folders)) {
    throw new Error('A folder cannot be moved inside itself or one of its subfolders.')
  }

  return parent
}

export async function getAllFolders() {
  const [folders, artworks] = await Promise.all([
    db.folders.orderBy('name').toArray(),
    db.artworks.toArray(),
  ])

  return folders.map((folder) => enrichFolder(folder, artworks, folders))
}

export async function getFolderById(id) {
  const folder = await db.folders.get(id)
  if (!folder) return null

  const [artworks, folders] = await Promise.all([db.artworks.toArray(), db.folders.toArray()])
  return enrichFolder(folder, artworks, folders)
}

export async function createFolder(name, parentFolderId = null) {
  const trimmed = normalizeFolderName(name)
  if (!trimmed) {
    throw new Error('Folder name is required.')
  }

  const existing = await db.folders.toArray()
  const parent = await assertValidParentFolder(parentFolderId, existing)

  if (isDuplicateFolderName(trimmed, existing, parent)) {
    throw new Error('A folder with this name already exists here.')
  }

  const now = new Date().toISOString()
  const folder = {
    id: generateId(),
    name: trimmed,
    parentFolderId: parent,
    createdAt: now,
    updatedAt: now,
  }

  await db.folders.add(folder)
  return folder
}

export async function updateFolder(id, { name, parentFolderId }) {
  const folder = await db.folders.get(id)
  if (!folder) {
    throw new Error('Folder not found.')
  }

  const trimmed = normalizeFolderName(name)
  if (!trimmed) {
    throw new Error('Folder name is required.')
  }

  const existing = await db.folders.toArray()
  const parent = await assertValidParentFolder(parentFolderId, existing, id)

  if (isDuplicateFolderName(trimmed, existing, parent, id)) {
    throw new Error('A folder with this name already exists here.')
  }

  const updatedAt = new Date().toISOString()
  await db.folders.update(id, {
    name: trimmed,
    parentFolderId: parent,
    updatedAt,
  })

  return {
    ...folder,
    name: trimmed,
    parentFolderId: parent,
    updatedAt,
  }
}

export async function renameFolder(id, name, parentFolderId) {
  return updateFolder(id, { name, parentFolderId })
}

export async function deleteFolder(id, { moveContentsTo = 'root' } = {}) {
  const folder = await db.folders.get(id)
  if (!folder) {
    throw new Error('Folder not found.')
  }

  const targetFolderId =
    moveContentsTo === 'parent' ? normalizeParentFolderId(folder.parentFolderId) : null
  const targetChildParentId = targetFolderId

  await db.transaction('rw', db.artworks, db.folders, async () => {
    const [artworks, folders] = await Promise.all([
      db.artworks.where('folderId').equals(id).toArray(),
      db.folders.toArray(),
    ])
    const childFolders = folders.filter(
      (item) => normalizeParentFolderId(item.parentFolderId) === id,
    )
    const now = new Date().toISOString()

    for (const artwork of artworks) {
      await db.artworks.put(
        buildMetadataOnlyArtworkRecord(artwork, {
          folderId: targetFolderId,
          updatedAt: now,
        }),
      )
    }

    for (const childFolder of childFolders) {
      await db.folders.update(childFolder.id, {
        parentFolderId: targetChildParentId,
        updatedAt: now,
      })
    }

    await db.folders.delete(id)
  })

  return folder
}

export async function getUnfiledCount() {
  const artworks = await db.artworks.toArray()
  return artworks.filter((artwork) => !artwork.folderId).length
}

export function getFolderName(folderId, folders) {
  if (!folderId) return null
  return folders.find((folder) => folder.id === folderId)?.name || null
}
