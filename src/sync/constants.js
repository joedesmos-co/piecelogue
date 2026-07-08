export const SYNC_ENTITY_TYPES = {
  FOLDER: 'folder',
  FOLDER_DELETE: 'folder-delete',
  ARTWORK: 'artwork',
  ARTWORK_DELETE: 'artwork-delete',
  ARTWORK_IMAGE: 'artwork-image',
}

export const SYNC_PRIORITIES = {
  [SYNC_ENTITY_TYPES.FOLDER_DELETE]: 0,
  [SYNC_ENTITY_TYPES.ARTWORK_DELETE]: 0,
  [SYNC_ENTITY_TYPES.FOLDER]: 1,
  [SYNC_ENTITY_TYPES.ARTWORK]: 2,
  [SYNC_ENTITY_TYPES.ARTWORK_IMAGE]: 3,
}

export const SYNC_JOB_STATUS = {
  PENDING: 'pending',
  FAILED: 'failed',
}

export const MAX_IMAGE_UPLOAD_CONCURRENCY = 2
export const MAX_SYNC_ATTEMPTS = 5
