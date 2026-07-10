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

export async function fetchWithTimeout(url, options = {}, timeoutMs) {
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs)
  const signal = linkAbortSignals(options.signal, timeoutController.signal)

  try {
    return await fetch(url, {
      ...options,
      signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      if (options.signal?.aborted) {
        throw new ApiError('Sync cancelled.', 'cancelled', 0)
      }
      throw new ApiError(
        'Request timed out. Retry when your connection is stable.',
        'timeout',
        408,
      )
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
