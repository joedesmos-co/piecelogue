import { ApiError } from './api.js'

const ERROR_MESSAGES = {
  unauthorized: 'Please sign in to continue.',
  service_unavailable: 'Cloud service is temporarily unavailable. Your changes are saved locally.',
  not_found: 'That item could not be found.',
  invalid_folder: 'Folder data could not be saved. Please try again.',
  invalid_artwork: 'Artwork data could not be saved. Please try again.',
  invalid_image: 'Image upload failed. Check the file and try again.',
  payload_too_large: 'File is too large to upload.',
  upload_failed: 'Image upload failed. Please try again.',
  rate_limit: 'Too many requests. Please wait a moment and try again.',
  too_many_requests: 'Too many requests. Please wait a moment and try again.',
  username_taken: 'That username is already taken.',
  invalid_username: 'Username is not valid.',
  forbidden: 'You do not have permission to do that.',
  invalid_token: 'This sign-in link is invalid or has expired.',
  invalid_email: 'Please enter a valid email address.',
  invalid_confirmation: 'Confirmation text did not match. Check spelling and try again.',
  network: 'Could not reach Piecelogue. Check your connection — your local library is safe.',
  offline: 'You are offline. Changes stay on this device and will sync when you reconnect.',
  sync_conflict: 'Sync conflict — review conflicts on Profile before changes can upload.',
  invalid_json: 'The request could not be processed. Please try again.',
}

function isNetworkFailure(error) {
  if (!error) {
    return false
  }

  if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
    return true
  }

  return error instanceof ApiError && error.status === 0
}

export function formatUserError(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) {
    return fallback
  }

  if (isNetworkFailure(error)) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return ERROR_MESSAGES.offline
    }
    return ERROR_MESSAGES.network
  }

  if (error instanceof ApiError && error.code && ERROR_MESSAGES[error.code]) {
    return ERROR_MESSAGES[error.code]
  }

  if (error.code && ERROR_MESSAGES[error.code]) {
    return ERROR_MESSAGES[error.code]
  }

  const message = typeof error.message === 'string' ? error.message.trim() : ''
  if (message && !/^Request failed \(\d+\)$/.test(message)) {
    return message
  }

  return fallback
}
