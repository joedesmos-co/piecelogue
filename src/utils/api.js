import { fetchWithTimeout } from './fetchWithTimeout.js'

export class ApiError extends Error {
  constructor(message, code = null, status = null) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export async function apiFetch(path, options = {}, timeoutMs = 20_000) {
  const headers = { ...options.headers }

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetchWithTimeout(
    path,
    {
      credentials: 'include',
      ...options,
      headers,
    },
    timeoutMs,
  )

  let data = null
  const contentType = response.headers.get('Content-Type') || ''
  if (contentType.includes('application/json')) {
    data = await response.json()
  }

  if (!response.ok) {
    const message = data?.error?.message || `Request failed (${response.status})`
    throw new ApiError(message, data?.error?.code, response.status)
  }

  if (data?.ok === false) {
    const message = data?.error?.message || 'Request failed'
    throw new ApiError(message, data?.error?.code, response.status)
  }

  return data
}
