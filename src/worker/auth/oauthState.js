import {
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME_DEV,
  OAUTH_STATE_MAX_AGE_SECONDS,
} from './constants.js'
import { generateSecureToken } from './tokens.js'

function isSecureRequest(request) {
  const url = new URL(request.url)
  return url.protocol === 'https:'
}

function isProduction(env) {
  return env?.ENVIRONMENT === 'production'
}

export function getOAuthStateCookieName(env) {
  return isProduction(env) ? OAUTH_STATE_COOKIE_NAME : OAUTH_STATE_COOKIE_NAME_DEV
}

export function createOAuthState() {
  return generateSecureToken()
}

export function getOAuthStateFromRequest(request, env) {
  const cookieHeader = request.headers.get('Cookie')
  if (!cookieHeader) return null

  const cookieName = getOAuthStateCookieName(env)

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValueParts] = part.trim().split('=')
    if (rawName === cookieName) {
      const value = rawValueParts.join('=')
      return value ? decodeURIComponent(value) : null
    }
  }

  return null
}

export function buildOAuthStateValue(state, nonce = null) {
  return nonce ? `${state}.${nonce}` : state
}

export function parseOAuthStateValue(value) {
  if (!value) {
    return { state: null, nonce: null }
  }

  const dotIndex = value.indexOf('.')
  if (dotIndex === -1) {
    return { state: value, nonce: null }
  }

  return {
    state: value.slice(0, dotIndex),
    nonce: value.slice(dotIndex + 1) || null,
  }
}

export function buildOAuthStateCookie(state, request, env, options = {}) {
  const { sameSite = 'Lax', nonce = null } = options
  const cookieName = getOAuthStateCookieName(env)
  const secure =
    sameSite === 'None' ? true : isProduction(env) ? true : isSecureRequest(request)
  const parts = [
    `${cookieName}=${encodeURIComponent(buildOAuthStateValue(state, nonce))}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${OAUTH_STATE_MAX_AGE_SECONDS}`,
    `SameSite=${sameSite}`,
  ]

  if (secure) {
    parts.push('Secure')
  }

  return parts.join('; ')
}

export function buildClearOAuthStateCookie(request, env, options = {}) {
  const { sameSite = 'Lax' } = options
  const cookieName = getOAuthStateCookieName(env)
  const secure =
    sameSite === 'None' ? true : isProduction(env) ? true : isSecureRequest(request)
  const parts = [
    `${cookieName}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    `SameSite=${sameSite}`,
  ]

  if (secure) {
    parts.push('Secure')
  }

  return parts.join('; ')
}

export function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false
  }

  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

export function validateOAuthState(request, env, callbackState) {
  if (!callbackState) {
    return false
  }

  const cookieState = getOAuthStateFromRequest(request, env)
  if (!cookieState) {
    return false
  }

  const { state: storedState } = parseOAuthStateValue(cookieState)
  if (!storedState) {
    return false
  }

  return constantTimeEqual(storedState, callbackState)
}

export function getOAuthNonceFromRequest(request, env) {
  const cookieState = getOAuthStateFromRequest(request, env)
  if (!cookieState) {
    return null
  }

  return parseOAuthStateValue(cookieState).nonce
}
