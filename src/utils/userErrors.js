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
  username_taken: 'That username is already taken.',
  invalid_username: 'Username is not valid.',
  forbidden: 'You do not have permission to do that.',
  invalid_token: 'This sign-in link is invalid or has expired.',
  invalid_email: 'Please enter a valid email address.',
}

export function formatUserError(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) {
    return fallback
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
