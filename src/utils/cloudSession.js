import { fetchMe } from '../api/auth.js'
import { fetchCloudStatus } from '../api/cloud.js'
import { ApiError, requireLiveSession } from './api.js'

/**
 * Preflight checks before sync/restore/destructive cloud work.
 * Stops immediately on unauthenticated or cloud-status failure.
 */
export async function verifyCloudSession() {
  const me = await requireLiveSession(fetchMe)
  let status
  try {
    status = await fetchCloudStatus()
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      throw error
    }
    throw error
  }
  return { me, status }
}
