import {
  APPLE_ISSUER,
  decodeJwtPart,
  importAppleJwk,
  verifyJwtSignature,
} from './appleJwt.js'

export { APPLE_ISSUER }

export const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys'

let cachedJwks = null
let cachedJwksFetchedAt = 0
const JWKS_CACHE_MS = 60 * 60 * 1000

export function resetAppleJwksCacheForTests() {
  cachedJwks = null
  cachedJwksFetchedAt = 0
}

export async function fetchAppleJwks(fetchImpl = fetch) {
  const now = Date.now()
  if (cachedJwks && now - cachedJwksFetchedAt < JWKS_CACHE_MS) {
    return cachedJwks
  }

  const response = await fetchImpl(APPLE_JWKS_URL)
  if (!response.ok) {
    throw new Error('Failed to load Apple JWKS.')
  }

  const jwks = await response.json()
  if (!Array.isArray(jwks.keys) || jwks.keys.length === 0) {
    throw new Error('Apple JWKS did not contain keys.')
  }

  cachedJwks = jwks
  cachedJwksFetchedAt = now
  return jwks
}

export function isAppleEmailVerified(emailVerifiedClaim) {
  return emailVerifiedClaim === true || emailVerifiedClaim === 'true'
}

export function validateAppleIdTokenClaims(payload, { clientId, nonce }) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Apple ID token payload is invalid.')
  }

  if (payload.iss !== APPLE_ISSUER) {
    throw new Error('Apple ID token issuer is invalid.')
  }

  if (payload.aud !== clientId) {
    throw new Error('Apple ID token audience is invalid.')
  }

  const now = Math.floor(Date.now() / 1000)
  if (!payload.exp || payload.exp <= now) {
    throw new Error('Apple ID token has expired.')
  }

  if (nonce && payload.nonce !== nonce) {
    throw new Error('Apple ID token nonce is invalid.')
  }

  if (!isAppleEmailVerified(payload.email_verified)) {
    throw new Error('Apple account email is not verified.')
  }

  if (!payload.email || typeof payload.email !== 'string') {
    throw new Error('Apple account did not provide an email address.')
  }

  return payload
}

export async function verifyAppleIdToken(idToken, { clientId, nonce, fetchImpl = fetch }) {
  const parts = idToken.split('.')
  if (parts.length !== 3) {
    throw new Error('Apple ID token format is invalid.')
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts
  const header = decodeJwtPart(encodedHeader)
  const payload = decodeJwtPart(encodedPayload)

  if (header.alg !== 'ES256') {
    throw new Error('Apple ID token algorithm is invalid.')
  }

  if (!header.kid) {
    throw new Error('Apple ID token is missing key id.')
  }

  const jwks = await fetchAppleJwks(fetchImpl)
  const jwk = jwks.keys.find((key) => key.kid === header.kid)
  if (!jwk) {
    throw new Error('Apple ID token signing key was not found.')
  }

  const publicKey = await importAppleJwk(jwk)
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const signatureValid = await verifyJwtSignature({
    signingInput,
    signaturePart: encodedSignature,
    publicKey,
  })

  if (!signatureValid) {
    throw new Error('Apple ID token signature is invalid.')
  }

  return validateAppleIdTokenClaims(payload, { clientId, nonce })
}
