import { fetchWithTimeout } from './fetchWithTimeout.js'
import {
  notifyUnauthorized,
  recordApiRequestDiagnostic,
} from './apiDiagnostics.js'

export class ApiError extends Error {
  constructor(message, code = null, status = null) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

function resolveMethod(options = {}) {
  return String(options.method || 'GET').toUpperCase()
}

export async function apiFetch(path, options = {}, timeoutMs = 20_000) {
  const headers = { ...options.headers }
  const method = resolveMethod(options)

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  // Always force credentials after spreading options so callers cannot drop cookies.
  const response = await fetchWithTimeout(
    path,
    {
      ...options,
      method,
      headers,
      credentials: 'include',
    },
    timeoutMs,
  )

  let data = null
  let wasJson = false
  const contentType = response.headers.get('Content-Type') || ''
  if (contentType.includes('application/json')) {
    wasJson = true
    data = await response.json()
  }

  const diagnostic = recordApiRequestDiagnostic({
    path,
    method,
    status: response.status,
    ok: response.ok,
    wasJson,
    credentials: 'include',
    errorCode: data?.error?.code ?? null,
    errorMessage: data?.error?.message ?? null,
  })

  if (!response.ok) {
    const message = data?.error?.message || `Request failed (${response.status})`
    const code = data?.error?.code ?? null
    if (response.status === 401) {
      notifyUnauthorized({
        path,
        method,
        errorCode: code || 'unauthorized',
      })
    }
    const error = new ApiError(message, code, response.status)
    error.diagnostic = diagnostic
    throw error
  }

  if (data?.ok === false) {
    const message = data?.error?.message || 'Request failed'
    const code = data?.error?.code ?? null
    const error = new ApiError(message, code, response.status)
    error.diagnostic = diagnostic
    throw error
  }

  return data
}

/**
 * Assert the browser still has a live session before destructive/long cloud work.
 */
export async function requireLiveSession(fetchMeImpl) {
  const result = await fetchMeImpl()
  if (!result?.authenticated) {
    notifyUnauthorized({
      path: '/api/auth/me',
      method: 'GET',
      errorCode: 'unauthorized',
    })
    throw new ApiError(
      'Your session expired. Sign in again.',
      'unauthorized',
      401,
    )
  }
  return result
}
