import { AUTH_CACHE_HEADERS, MAX_JSON_BODY_BYTES } from '../auth/constants.js'
import { getSessionTokenFromRequest } from '../auth/cookies.js'
import {
  findUserByUsername,
  getUserProfileById,
  publicProfile,
  updateUserUsername,
} from '../auth/profile.js'
import { getActiveSessionForToken } from '../auth/sessions.js'
import { validateUsername } from '../auth/username.js'
import { jsonError, jsonOk, methodNotAllowed } from '../http.js'

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

function withProfileHeaders(response) {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(AUTH_CACHE_HEADERS)) {
    headers.set(key, value)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

async function requireAuthenticatedUser(request, env) {
  if (!env.DB) {
    return { error: jsonError(503, 'service_unavailable', 'Service is temporarily unavailable.') }
  }

  const sessionToken = getSessionTokenFromRequest(request, env)
  if (!sessionToken) {
    return { error: jsonError(401, 'unauthorized', 'Sign in required.') }
  }

  const sessionUser = await getActiveSessionForToken(env.DB, sessionToken)
  if (!sessionUser) {
    return { error: jsonError(401, 'unauthorized', 'Sign in required.') }
  }

  const profile = await getUserProfileById(env.DB, sessionUser.id)
  if (!profile) {
    return { error: jsonError(401, 'unauthorized', 'Sign in required.') }
  }

  return { user: profile }
}

async function handleGetProfile(request, env) {
  if (request.method !== 'GET') {
    return methodNotAllowed(['GET'])
  }

  const auth = await requireAuthenticatedUser(request, env)
  if (auth.error) {
    return withProfileHeaders(auth.error)
  }

  return withProfileHeaders(
    jsonOk({
      ok: true,
      profile: publicProfile(auth.user),
    }),
  )
}

async function handlePatchUsername(request, env) {
  if (request.method !== 'PATCH') {
    return methodNotAllowed(['PATCH'])
  }

  const auth = await requireAuthenticatedUser(request, env)
  if (auth.error) {
    return withProfileHeaders(auth.error)
  }

  let body
  try {
    body = await readJsonBody(request)
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return withProfileHeaders(jsonError(413, 'payload_too_large', 'Request body is too large.'))
    }
    if (error instanceof InvalidJsonError) {
      return withProfileHeaders(jsonError(400, 'invalid_json', 'Invalid JSON body.'))
    }
    throw error
  }

  const validation = validateUsername(body.username)
  if (!validation.ok) {
    return withProfileHeaders(jsonError(400, validation.code, validation.message))
  }

  const existing = await findUserByUsername(env.DB, validation.username)
  if (existing && existing.id !== auth.user.id) {
    return withProfileHeaders(jsonError(409, 'username_taken', 'That username is already taken.'))
  }

  await updateUserUsername(env.DB, auth.user.id, validation.username)
  const updated = await getUserProfileById(env.DB, auth.user.id)

  return withProfileHeaders(
    jsonOk({
      ok: true,
      profile: publicProfile(updated),
    }),
  )
}

export async function handleProfileRoute(request, env, path) {
  switch (path) {
    case '/api/profile':
      return handleGetProfile(request, env)
    case '/api/profile/username':
      return handlePatchUsername(request, env)
    default:
      return null
  }
}
