const USERNAME_RE = /^[a-z0-9_]{3,24}$/

export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 24

export function normalizeUsername(value) {
  if (typeof value !== 'string') return ''

  let username = value.trim().toLowerCase()
  if (username.startsWith('@')) {
    username = username.slice(1)
  }

  return username
}

export function isValidUsername(username) {
  const normalized = normalizeUsername(username)
  if (!normalized) return false
  return USERNAME_RE.test(normalized)
}

export function validateUsername(username) {
  const normalized = normalizeUsername(username)

  if (!normalized) {
    return { ok: false, code: 'invalid_username', message: 'Username is required.' }
  }

  if (normalized.length < USERNAME_MIN_LENGTH || normalized.length > USERNAME_MAX_LENGTH) {
    return {
      ok: false,
      code: 'invalid_username',
      message: `Username must be ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters.`,
    }
  }

  if (!USERNAME_RE.test(normalized)) {
    return {
      ok: false,
      code: 'invalid_username',
      message: 'Username can only contain letters, numbers, and underscores.',
    }
  }

  return { ok: true, username: normalized }
}

export function formatUsernameHandle(username) {
  const normalized = normalizeUsername(username)
  return normalized ? `@${normalized}` : null
}
