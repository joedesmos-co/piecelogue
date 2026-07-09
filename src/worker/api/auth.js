import { AUTH_CACHE_HEADERS, MAX_JSON_BODY_BYTES, VERIFY_REDIRECT_HEADERS } from '../auth/constants.js'
import { cleanupExpiredAuthRecords } from '../auth/cleanup.js'
import { buildClearSessionCookie, buildSessionCookie, getSessionTokenFromRequest } from '../auth/cookies.js'
import { isValidEmail, normalizeEmail } from '../auth/email.js'
import {
  createMagicLink,
  consumeMagicLink,
  getRecentMagicLinkRequest,
  isWithinRequestCooldown,
} from '../auth/magicLinks.js'
import {
  createSession,
  findOrCreateVerifiedUser,
  getActiveSessionForToken,
  revokeSessionForToken,
} from '../auth/sessions.js'
import { sendMagicLinkEmail, isDevMode, buildMagicLinkUrl } from '../email/sendMagicLinkEmail.js'
import { handleAppleCallback, handleAppleStart } from './appleAuth.js'
import { handleGoogleCallback, handleGoogleStart } from './googleAuth.js'
import { jsonError, jsonOk, methodNotAllowed } from '../http.js'

const GENERIC_REQUEST_LINK_MESSAGE =
  'If that email can receive mail, a sign-in link has been sent.'

class InvalidJsonError extends Error {
  constructor() {
    super('Invalid JSON body')
    this.name = 'InvalidJsonError'
  }
}

class BodyTooLargeError extends Error {
  constructor() {
    super('Request body too large')
    this.name = 'BodyTooLargeError'
  }
}

async function readJsonBody(request) {
  const contentLength = Number(request.headers.get('Content-Length') || 0)
  if (contentLength > MAX_JSON_BODY_BYTES) {
    throw new BodyTooLargeError()
  }

  const text = await request.text()
  if (text.length > MAX_JSON_BODY_BYTES) {
    throw new BodyTooLargeError()
  }

  if (!text.trim()) {
    return {}
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new InvalidJsonError()
  }
}

function withAuthHeaders(response, extraHeaders = {}) {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries({ ...AUTH_CACHE_HEADERS, ...extraHeaders })) {
    headers.set(key, value)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function publicUser(user) {
  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName ?? user.display_name ?? null,
  }
}

async function handleRequestLink(request, env) {
  if (request.method !== 'POST') {
    return methodNotAllowed(['POST'])
  }

  if (!env.DB) {
    console.error('[Piecelogue] D1 binding DB is missing.')
    return withAuthHeaders(jsonError(503, 'service_unavailable', 'Service is temporarily unavailable.'))
  }

  await cleanupExpiredAuthRecords(env.DB)

  let body
  try {
    body = await readJsonBody(request)
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return withAuthHeaders(jsonError(413, 'payload_too_large', 'Request body is too large.'))
    }
    if (error instanceof InvalidJsonError) {
      return withAuthHeaders(jsonError(400, 'invalid_json', 'Invalid JSON body.'))
    }
    throw error
  }

  const normalizedEmail = normalizeEmail(body.email)
  if (!isValidEmail(normalizedEmail)) {
    return withAuthHeaders(
      jsonOk({
        ok: true,
        message: GENERIC_REQUEST_LINK_MESSAGE,
      }),
    )
  }

  const recent = await getRecentMagicLinkRequest(env.DB, normalizedEmail)
  if (isWithinRequestCooldown(recent?.created_at)) {
    return withAuthHeaders(
      jsonError(429, 'too_many_requests', GENERIC_REQUEST_LINK_MESSAGE),
    )
  }

  const { rawToken } = await createMagicLink(env.DB, normalizedEmail)

  if (isDevMode(env)) {
    return withAuthHeaders(
      jsonOk({
        ok: true,
        dev: {
          magicLink: buildMagicLinkUrl(env, rawToken, request),
        },
      }),
    )
  }

  try {
    await sendMagicLinkEmail(env, normalizedEmail, rawToken, request)

    return withAuthHeaders(
      jsonOk({
        ok: true,
        message: GENERIC_REQUEST_LINK_MESSAGE,
      }),
    )
  } catch (error) {
    console.error('[Piecelogue] Magic link email delivery failed:', error?.message || error)
    return withAuthHeaders(
      jsonError(503, 'service_unavailable', 'Unable to send a sign-in link right now. Please try again later.'),
    )
  }
}

async function handleVerify(request, env) {
  if (request.method !== 'GET') {
    return methodNotAllowed(['GET'])
  }

  if (!env.DB) {
    console.error('[Piecelogue] D1 binding DB is missing.')
    return withAuthHeaders(
      jsonError(503, 'service_unavailable', 'Service is temporarily unavailable.'),
      VERIFY_REDIRECT_HEADERS,
    )
  }

  await cleanupExpiredAuthRecords(env.DB)

  const url = new URL(request.url)
  const rawToken = url.searchParams.get('token')?.trim()

  if (!rawToken) {
    return withAuthHeaders(
      jsonError(400, 'invalid_token', 'This sign-in link is invalid or has expired.'),
      VERIFY_REDIRECT_HEADERS,
    )
  }

  const consumed = await consumeMagicLink(env.DB, rawToken)
  if (!consumed) {
    return withAuthHeaders(
      jsonError(400, 'invalid_token', 'This sign-in link is invalid or has expired.'),
      VERIFY_REDIRECT_HEADERS,
    )
  }

  const user = await findOrCreateVerifiedUser(env.DB, consumed.email)
  const session = await createSession(env.DB, user.id)
  const origin = (env.APP_ORIGIN || 'https://piecelogue.com').replace(/\/$/, '')

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${origin}/app?auth=success&view=profile`,
      'Set-Cookie': buildSessionCookie(session.rawToken, request, env),
      ...VERIFY_REDIRECT_HEADERS,
    },
  })
}

async function handleMe(request, env) {
  if (request.method !== 'GET') {
    return methodNotAllowed(['GET'])
  }

  if (!env.DB) {
    console.error('[Piecelogue] D1 binding DB is missing.')
    return withAuthHeaders(jsonError(503, 'service_unavailable', 'Service is temporarily unavailable.'))
  }

  await cleanupExpiredAuthRecords(env.DB)

  const sessionToken = getSessionTokenFromRequest(request, env)
  if (!sessionToken) {
    return withAuthHeaders(
      jsonOk({
        ok: true,
        authenticated: false,
        user: null,
      }),
    )
  }

  const user = await getActiveSessionForToken(env.DB, sessionToken)
  if (!user) {
    return withAuthHeaders(
      jsonOk({
        ok: true,
        authenticated: false,
        user: null,
      }),
    )
  }

  return withAuthHeaders(
    jsonOk({
      ok: true,
      authenticated: true,
      user: publicUser(user),
    }),
  )
}

async function handleLogout(request, env) {
  if (request.method !== 'POST') {
    return methodNotAllowed(['POST'])
  }

  const sessionToken = getSessionTokenFromRequest(request, env)

  if (env.DB && sessionToken) {
    await revokeSessionForToken(env.DB, sessionToken)
  }

  return withAuthHeaders(
    jsonOk({ ok: true }),
    {
      'Set-Cookie': buildClearSessionCookie(request, env),
    },
  )
}

export async function handleAuthRoute(request, env, path) {
  switch (path) {
    case '/api/auth/request-link':
      return handleRequestLink(request, env)
    case '/api/auth/verify':
      return handleVerify(request, env)
    case '/api/auth/me':
      return handleMe(request, env)
    case '/api/auth/logout':
      return handleLogout(request, env)
    case '/api/auth/google/start':
      return handleGoogleStart(request, env)
    case '/api/auth/google/callback':
      return handleGoogleCallback(request, env)
    case '/api/auth/apple/start':
      return handleAppleStart(request, env)
    case '/api/auth/apple/callback':
      return handleAppleCallback(request, env)
    default:
      return null
  }
}
