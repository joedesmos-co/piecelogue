import { ApiError } from './api.js'

function linkAbortSignals(...signals) {
  const active = signals.filter(Boolean)
  if (active.length === 0) {
    return undefined
  }

  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(active)
  }

  const controller = new AbortController()
  for (const signal of active) {
    if (signal.aborted) {
      controller.abort()
      return controller.signal
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  return controller.signal
}

export async function runWithWatchdog(
  task,
  { timeoutMs, signal, timeoutMessage = 'Operation timed out.' },
) {
  let timeoutId = null
  let removeCancellationListener = null

  const watchdogPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new ApiError(timeoutMessage, 'timeout', 408))
    }, timeoutMs)
  })

  const cancellationPromise = new Promise((_, reject) => {
    if (!signal) {
      return
    }

    const rejectCancelled = () => {
      reject(new ApiError('Sync cancelled.', 'cancelled', 0))
    }

    if (signal.aborted) {
      rejectCancelled()
      return
    }

    signal.addEventListener('abort', rejectCancelled, { once: true })
    removeCancellationListener = () => signal.removeEventListener('abort', rejectCancelled)
  })

  try {
    return await Promise.race([Promise.resolve().then(task), watchdogPromise, cancellationPromise])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    removeCancellationListener?.()
  }
}

export async function fetchWithTimeout(url, options = {}, timeoutMs) {
  const timeoutController = new AbortController()
  const signal = linkAbortSignals(options.signal, timeoutController.signal)
  let timedOut = false
  let timeoutId = null
  let removeCancellationListener = null

  try {
    const fetchPromise = fetch(url, {
      ...options,
      signal,
    }).catch((error) => {
      if (error?.name !== 'AbortError') {
        throw error
      }

      if (timedOut) {
        throw new ApiError(
          'Request timed out. Retry when your connection is stable.',
          'timeout',
          408,
        )
      }

      if (options.signal?.aborted) {
        throw new ApiError('Sync cancelled.', 'cancelled', 0)
      }

      throw error
    })

    const watchdogPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        timedOut = true
        timeoutController.abort()
        reject(
          new ApiError(
            'Request timed out. Retry when your connection is stable.',
            'timeout',
            408,
          ),
        )
      }, timeoutMs)
    })

    const cancellationPromise = new Promise((_, reject) => {
      if (!options.signal) {
        return
      }

      const rejectCancelled = () => {
        reject(new ApiError('Sync cancelled.', 'cancelled', 0))
      }

      if (options.signal.aborted) {
        rejectCancelled()
        return
      }

      options.signal.addEventListener('abort', rejectCancelled, { once: true })
      removeCancellationListener = () =>
        options.signal.removeEventListener('abort', rejectCancelled)
    })

    return await Promise.race([fetchPromise, watchdogPromise, cancellationPromise])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    removeCancellationListener?.()
  }
}
