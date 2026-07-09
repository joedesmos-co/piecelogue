import { getAppOrigin } from './googleOAuth.js'
import { createAppleClientSecret } from './appleJwt.js'

const APPLE_AUTH_URL = 'https://appleid.apple.com/auth/authorize'
const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token'

export function getAppleRedirectUri(env, request) {
  return `${getAppOrigin(env, request)}/api/auth/apple/callback`
}

export function isAppleOAuthConfigured(env) {
  return Boolean(
    env.APPLE_CLIENT_ID &&
      env.APPLE_TEAM_ID &&
      env.APPLE_KEY_ID &&
      env.APPLE_PRIVATE_KEY,
  )
}

export function buildAppleAuthUrl({ clientId, redirectUri, state, nonce }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    response_mode: 'form_post',
    scope: 'name email',
    state,
    nonce,
  })

  return `${APPLE_AUTH_URL}?${params.toString()}`
}

export async function createAppleClientSecretFromEnv(env) {
  return createAppleClientSecret({
    teamId: env.APPLE_TEAM_ID,
    clientId: env.APPLE_CLIENT_ID,
    keyId: env.APPLE_KEY_ID,
    privateKeyPem: env.APPLE_PRIVATE_KEY,
  })
}

export async function exchangeAppleCode({ clientId, clientSecret, code, redirectUri }) {
  const response = await fetch(APPLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Apple token exchange failed.')
  }

  if (!data.id_token) {
    throw new Error('Apple token exchange did not return an id_token.')
  }

  return data
}

export function parseAppleUserField(userField) {
  if (!userField) {
    return { displayName: null }
  }

  try {
    const user = typeof userField === 'string' ? JSON.parse(userField) : userField
    const first = user?.name?.firstName?.trim() || ''
    const last = user?.name?.lastName?.trim() || ''
    const displayName = [first, last].filter(Boolean).join(' ') || null
    return { displayName }
  } catch {
    return { displayName: null }
  }
}
