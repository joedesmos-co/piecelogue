import { TOKEN_BYTE_LENGTH } from './constants.js'

function base64UrlEncode(bytes) {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function generateSecureToken(byteLength = TOKEN_BYTE_LENGTH) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength))
  return base64UrlEncode(bytes)
}

export async function hashToken(token) {
  const data = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(digest))
}

export function nowIso() {
  return new Date().toISOString()
}

export function expiresAtIso(ttlMs) {
  return new Date(Date.now() + ttlMs).toISOString()
}

export function isExpired(isoTimestamp, now = Date.now()) {
  return Date.parse(isoTimestamp) <= now
}
