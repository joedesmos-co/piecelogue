import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME_DEV,
  SESSION_MAX_AGE_SECONDS,
} from './constants.js'

function isSecureRequest(request) {
  const url = new URL(request.url)
  return url.protocol === 'https:'
}

function isProduction(env) {
  return env?.ENVIRONMENT === 'production'
}

export function getSessionCookieName(env) {
  return isProduction(env) ? SESSION_COOKIE_NAME : SESSION_COOKIE_NAME_DEV
}

export function getSessionTokenFromRequest(request, env) {
  const cookieHeader = request.headers.get('Cookie')
  if (!cookieHeader) return null

  const cookieName = getSessionCookieName(env)

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValueParts] = part.trim().split('=')
    if (rawName === cookieName) {
      const value = rawValueParts.join('=')
      return value ? decodeURIComponent(value) : null
    }
  }

  return null
}

export function buildSessionCookie(sessionToken, request, env) {
  const cookieName = getSessionCookieName(env)
  const secure = isProduction(env) ? true : isSecureRequest(request)
  const parts = [
    `${cookieName}=${encodeURIComponent(sessionToken)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ]

  if (secure) {
    parts.push('Secure')
  }

  return parts.join('; ')
}

export function buildClearSessionCookie(request, env) {
  const cookieName = getSessionCookieName(env)
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
