import { SYNC_ENTITY_TYPES } from './constants.js'

export function describeSyncJobStage(entityType) {
  switch (entityType) {
    case SYNC_ENTITY_TYPES.FOLDER:
    case SYNC_ENTITY_TYPES.FOLDER_DELETE:
      return 'folders'
    case SYNC_ENTITY_TYPES.ARTWORK:
    case SYNC_ENTITY_TYPES.ARTWORK_DELETE:
      return 'metadata'
    case SYNC_ENTITY_TYPES.ARTWORK_IMAGE:
      return 'images'
    default:
      return 'sync'
  }
}

export function describeSyncJobStageLabel(stage) {
  switch (stage) {
    case 'folders':
      return 'Folders'
    case 'metadata':
      return 'Artwork metadata'
    case 'images':
      return 'Artwork images'
    default:
      return 'Sync'
  }
}

export function summarizeSyncFailures(jobs = []) {
  const failedJobs = jobs.filter((job) => job.status === 'failed')
  const byStage = new Map()

  for (const job of failedJobs) {
    const stage = describeSyncJobStage(job.entityType)
    const current = byStage.get(stage) || { stage, count: 0, message: job.lastError || 'Sync failed.' }
    current.count += 1
    if (!byStage.has(stage)) {
      byStage.set(stage, current)
    }
  }

  return Array.from(byStage.values())
}
