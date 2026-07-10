import { MAX_SYNC_ATTEMPTS } from './constants.js'

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504])

export function classifySyncError(error) {
  if (!error) {
    return { retryable: true, permanent: false }
  }

  if (error.name === 'ImageUploadError') {
    return { retryable: !error.permanent, permanent: Boolean(error.permanent) }
  }

  if (error.name === 'TypeError' || error.message === 'Failed to fetch') {
    return { retryable: true, permanent: false }
  }

  if (error.code === 'timeout' || error.code === 'cancelled') {
    return { retryable: error.code !== 'cancelled', permanent: false }
  }

  const status = error.status ?? null
  if (status === null) {
    return { retryable: true, permanent: false }
  }

  if (RETRYABLE_STATUS_CODES.has(status)) {
    return { retryable: true, permanent: false }
  }

  if (status >= 400 && status < 500) {
    return { retryable: false, permanent: true }
  }

  if (status >= 500) {
    return { retryable: true, permanent: false }
  }

  return { retryable: true, permanent: false }
}

export function computeBackoffMs(attempts) {
  const baseMs = 5000
  const exponent = Math.max(0, attempts - 1)
  return Math.min(baseMs * 2 ** exponent, 10 * 60 * 1000)
}

export function shouldRetryJob(job, classification) {
  if (classification.permanent) {
    return false
  }
  return (job.attempts ?? 0) < MAX_SYNC_ATTEMPTS
}

export function buildRetryUpdate(job, error, now = new Date()) {
  const classification = classifySyncError(error)
  const attempts = (job.attempts ?? 0) + 1
  const errorMessage =
    typeof error?.toDiagnosticString === 'function'
      ? error.toDiagnosticString()
      : error?.message || 'Sync failed.'

  if (!shouldRetryJob({ ...job, attempts }, classification)) {
    return {
      status: 'failed',
      attempts,
      lastError: errorMessage,
      nextRetryAt: null,
      processingStartedAt: null,
      updatedAt: now.toISOString(),
    }
  }

  const delayMs = computeBackoffMs(attempts)
  return {
    status: 'pending',
    attempts,
    lastError: errorMessage,
    nextRetryAt: new Date(now.getTime() + delayMs).toISOString(),
    processingStartedAt: null,
    updatedAt: now.toISOString(),
  }
}
