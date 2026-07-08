import { toLocalArtworkMetadata, toLocalFolder } from './restoreLogic.js'

export function extractUpsertRevision(response, entityId) {
  return response?.results?.find((item) => item.id === entityId)?.revision ?? null
}

export function localFolderFromCloud(cloud) {
  return {
    ...toLocalFolder(cloud),
    cloudRevision: cloud.revision ?? 1,
  }
}

export function localArtworkFromCloud(cloud) {
  return {
    ...toLocalArtworkMetadata(cloud),
    cloudRevision: cloud.revision ?? 1,
  }
}
