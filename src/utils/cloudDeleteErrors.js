import { ApiError } from './api.js'
import { formatUserError } from './userErrors.js'

/**
 * Distinct, safe messages for DELETE /api/account/cloud-data failures.
 */
export function formatCloudDeleteError(error) {
  if (!error) {
    return 'Could not delete cloud data.'
  }

  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Your session expired. Sign in again.'
    }
    if (error.status === 403) {
      return 'You do not have permission to delete cloud data.'
    }
    if (error.status === 429) {
      return 'Too many requests. Please wait a moment and try again.'
    }
    if (error.status >= 500) {
      return 'Server error while deleting cloud data. Please try again.'
    }
  }

  return formatUserError(error, 'Could not delete cloud data.')
}
