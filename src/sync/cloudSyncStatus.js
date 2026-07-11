import { describeImageUploadStage } from './imageUpload.js'

export function getCloudSyncStatusDetails(status, forcing) {
  const deleteNote =
    status.pendingDeleteCount > 0
      ? `${status.pendingDeleteCount} delete${status.pendingDeleteCount === 1 ? '' : 's'} waiting to sync.`
      : null

  if (forcing) {
    return {
      label: 'Force sync in progress',
      description: deleteNote || 'Detailed upload progress is shown below.',
    }
  }

  if (status.activeUpload) {
    return {
      label: describeImageUploadStage(status.activeUpload.stage),
      description: status.activeUpload.artworkTitle || deleteNote || 'Uploading your latest changes.',
    }
  }

  switch (status.state) {
    case 'up-to-date':
      return {
        label: 'Up to date',
        description: 'Your latest changes are saved in the cloud.',
      }
    case 'syncing':
      return {
        label: status.forceSyncActive ? 'Force syncing...' : 'Syncing...',
        description: deleteNote || 'Uploading your latest changes.',
      }
    case 'pending':
      return {
        label: `${status.pendingCount} change${status.pendingCount === 1 ? '' : 's'} waiting to sync`,
        description: deleteNote || 'Changes are queued and will upload shortly.',
      }
    case 'waiting':
      return {
        label: 'Waiting to retry sync',
        description:
          deleteNote ||
          (status.error
            ? status.error
            : `${status.pendingCount} change${status.pendingCount === 1 ? '' : 's'} will retry soon.`),
      }
    case 'offline':
      return {
        label: 'Offline — changes saved locally',
        description: deleteNote || 'Sync will resume when you are back online.',
      }
    case 'error':
      return {
        label: 'Sync error',
        description: status.error || 'Some changes could not be synced to the cloud.',
      }
    case 'conflict':
      return {
        label: 'Sync conflict — review needed',
        description:
          status.conflictCount > 1
            ? `${status.conflictCount} items need your review before sync can continue.`
            : 'An item was changed on another device. Review the conflict below.',
      }
    default:
      return { label: null, description: null }
  }
}
