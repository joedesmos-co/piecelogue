const SENSITIVE_KEY_PATTERN =
  /(token|secret|password|authorization|cookie|session|magic|hash|key)$/i

function sanitizeContext(context) {
  if (!context || typeof context !== 'object') {
    return {}
  }

  const safe = {}
  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      continue
    }
    if (typeof value === 'string' && value.length > 200) {
      safe[key] = `${value.slice(0, 200)}…`
      continue
    }
    safe[key] = value
  }
  return safe
}

export function logError(scope, error, context = {}) {
  const message = error?.message || String(error)
  const safeContext = sanitizeContext(context)
  console.error(`[Piecelogue] ${scope}:`, message, safeContext)
}

export function logInfo(scope, message, context = {}) {
  console.info(`[Piecelogue] ${scope}:`, message, sanitizeContext(context))
}
