const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(email) {
  if (typeof email !== 'string') return ''
  return email.trim().toLowerCase()
}

export function isValidEmail(email) {
  const normalized = normalizeEmail(email)
  if (!normalized || normalized.length > 254) return false
  return EMAIL_RE.test(normalized)
}
