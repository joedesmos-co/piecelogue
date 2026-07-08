import { db } from './database'

export async function getFolderCloudRevision(folderId) {
  const folder = await db.folders.get(folderId)
  return folder?.cloudRevision ?? 0
}

export async function setFolderCloudRevision(folderId, revision) {
  await db.folders.update(folderId, { cloudRevision: revision ?? 0 })
}

export async function getArtworkCloudRevision(artworkId) {
  const artwork = await db.artworks.get(artworkId)
  return artwork?.cloudRevision ?? 0
}

export async function setArtworkCloudRevision(artworkId, revision) {
  await db.artworks.update(artworkId, { cloudRevision: revision ?? 0 })
}
