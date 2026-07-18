/**
 * Safe, non-sensitive diagnostics for authenticated API traffic.
 * Never stores cookies, tokens, emails, or secrets.
 */

const MAX_HISTORY = 12

let lastRequest = null
const history = []
const unauthorizedListeners = new Set()

export function getDisplayMode() {
  if (typeof window === 'undefined') {
    return 'unknown'
  }

  try {
    if (window.navigator?.standalone === true) {
      return 'standalone'
    }
    if (typeof window.matchMedia === 'function') {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        return 'standalone'
      }
      if (window.matchMedia('(display-mode: fullscreen)').matches) {
        return 'fullscreen'
      }
    }
  } catch {
    // Ignore matchMedia failures.
  }

  return 'browser'
}

export function isStandaloneDisplayMode() {
  return getDisplayMode() === 'standalone'
}

function buildSafeEntry(partial = {}) {
  return {
    at: new Date().toISOString(),
    path: partial.path ?? null,
    method: partial.method ?? null,
    status: partial.status ?? null,
    ok: partial.ok ?? null,
    errorCode: partial.errorCode ?? null,
    errorMessage: partial.errorMessage ?? null,
    wasJson: partial.wasJson ?? null,
    online: typeof navigator === 'undefined' ? null : navigator.onLine !== false,
    credentials: partial.credentials ?? 'include',
    displayMode: getDisplayMode(),
  }
}

export function recordApiRequestDiagnostic(partial = {}) {
  const entry = buildSafeEntry(partial)
  lastRequest = entry
  history.unshift(entry)
  if (history.length > MAX_HISTORY) {
    history.length = MAX_HISTORY
  }
  return entry
}

export function getLastApiRequestDiagnostic() {
  return lastRequest
}

export function getApiRequestDiagnosticHistory() {
  return [...history]
}

export function clearApiRequestDiagnostics() {
  lastRequest = null
  history.length = 0
}

export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener)
  return () => {
    unauthorizedListeners.delete(listener)
  }
}

export function notifyUnauthorized(detail = {}) {
  const safe = {
    path: detail.path ?? null,
    method: detail.method ?? null,
    status: 401,
    errorCode: detail.errorCode ?? 'unauthorized',
    displayMode: getDisplayMode(),
  }
  for (const listener of unauthorizedListeners) {
    try {
      listener(safe)
    } catch {
      // Ignore listener failures.
    }
  }
}

export function buildCloudRequestSummary(entry) {
  if (!entry) {
    return 'No cloud requests yet.'
  }
  const status = entry.status == null ? 'no-status' : String(entry.status)
  const code = entry.errorCode ? ` (${entry.errorCode})` : ''
  return `${entry.method || 'GET'} ${entry.path || '/'} → ${status}${code}`
}
