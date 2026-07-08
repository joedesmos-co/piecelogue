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

export function buildOAuthStateCookie(state, request, env) {
  const cookieName = getOAuthStateCookieName(env)
  const secure = isProduction(env) ? true : isSecureRequest(request)
  const parts = [
    `${cookieName}=${encodeURIComponent(state)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${OAUTH_STATE_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ]

  if (secure) {
    parts.push('Secure')
  }

  return parts.join('; ')
}

export function buildClearOAuthStateCookie(request, env) {
  const cookieName = getOAuthStateCookieName(env)
  const secure = isProduction(env) ? true : isSecureRequest(request)
  const parts = [
    `${cookieName}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    'SameSite=Lax',
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

  return constantTimeEqual(cookieState, callbackState)
}
