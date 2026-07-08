import { db } from './database'
import { generateId } from '../utils/id'
import { coalesceArtworkBlobs, getGalleryImageBlobs } from '../utils/imageUtils'

function normalizeFolderName(name) {
  return (name || '').trim()
}

export function isDuplicateFolderName(name, folders, excludeId = null) {
  const normalized = normalizeFolderName(name).toLowerCase()
  if (!normalized) return false
  return folders.some(
    (folder) =>
      folder.id !== excludeId &&
      folder.name.trim().toLowerCase() === normalized,
  )
}

export async function getAllFolders() {
  const [folders, artworks] = await Promise.all([
    db.folders.orderBy('name').toArray(),
    db.artworks.toArray(),
  ])

  return folders.map((folder) => {
    const folderArtworks = artworks
      .filter((artwork) => artwork.folderId === folder.id)
      .map(coalesceArtworkBlobs)
    const previews = folderArtworks
      .slice(0, 3)
      .map((artwork) => getGalleryImageBlobs(artwork))

    return {
      ...folder,
      count: folderArtworks.length,
      previews,
    }
  })
}

export async function getFolderById(id) {
  const folder = await db.folders.get(id)
  if (!folder) return null

  const artworks = await db.artworks.where('folderId').equals(id).toArray()
  const normalizedArtworks = artworks.map(coalesceArtworkBlobs)
  const previews = normalizedArtworks
    .slice(0, 3)
    .map((artwork) => getGalleryImageBlobs(artwork))

  return {
    ...folder,
    count: normalizedArtworks.length,
    previews,
  }
}

export async function createFolder(name) {
  const trimmed = normalizeFolderName(name)
  if (!trimmed) {
    throw new Error('Folder name is required.')
  }

  const existing = await db.folders.toArray()
  if (isDuplicateFolderName(trimmed, existing)) {
    throw new Error('A folder with this name already exists.')
  }

  const now = new Date().toISOString()
  const folder = {
    id: generateId(),
    name: trimmed,
    createdAt: now,
    updatedAt: now,
  }

  await db.folders.add(folder)
  return folder
}

export async function renameFolder(id, name) {
  const folder = await db.folders.get(id)
  if (!folder) {
    throw new Error('Folder not found.')
  }

  const trimmed = normalizeFolderName(name)
  if (!trimmed) {
    throw new Error('Folder name is required.')
  }

  const existing = await db.folders.toArray()
  if (isDuplicateFolderName(trimmed, existing, id)) {
    throw new Error('A folder with this name already exists.')
  }

  const updatedAt = new Date().toISOString()
  await db.folders.update(id, { name: trimmed, updatedAt })
  return { ...folder, name: trimmed, updatedAt }
}

export async function deleteFolder(id) {
  const folder = await db.folders.get(id)
  if (!folder) {
    throw new Error('Folder not found.')
  }

  await db.transaction('rw', db.artworks, db.folders, async () => {
    const artworks = await db.artworks.where('folderId').equals(id).toArray()
    const now = new Date().toISOString()

    for (const artwork of artworks) {
      await db.artworks.update(artwork.id, { folderId: null, updatedAt: now })
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
