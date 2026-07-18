import { AUTH_CACHE_HEADERS, MAX_JSON_BODY_BYTES } from '../auth/constants.js'
import {
  validateDeleteAccountConfirmation,
  validateDeleteCloudDataConfirmation,
} from '../auth/accountConfirmations.js'
import { deleteUserAccount } from '../auth/accountService.js'
import { buildClearSessionCookie } from '../auth/cookies.js'
import { requireAuthenticatedUser } from '../auth/requireUser.js'
import { deleteAllUserCloudData } from '../cloud/storage.js'
import { logError } from '../log.js'
import {
  buildUserRateLimitKey,
  checkRateLimit,
  RATE_LIMITS,
} from '../rateLimit.js'
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

function withAccountHeaders(response, extraHeaders = {}) {
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

function invalidBodyResponse(error) {
  if (error instanceof BodyTooLargeError) {
    return withAccountHeaders(jsonError(413, 'payload_too_large', 'Request body is too large.'))
  }
  if (error instanceof InvalidJsonError) {
    return withAccountHeaders(jsonError(400, 'invalid_json', 'Invalid JSON body.'))
  }
  throw error
}

async function enforceDestructiveRateLimit(db, userId) {
  const result = await checkRateLimit(
    db,
    buildUserRateLimitKey('account:destructive', userId),
    RATE_LIMITS.ACCOUNT_DESTRUCTIVE,
  )

  if (!result.allowed) {
    return jsonError(
      429,
      'rate_limit',
      'Too many account actions. Please wait before trying again.',
    )
  }

  return null
}

async function handleDeleteCloudData(request, env) {
  // Accept POST as well as DELETE: iOS Safari / Home Screen can strip DELETE bodies.
  if (request.method !== 'DELETE' && request.method !== 'POST') {
    return withAccountHeaders(methodNotAllowed(['DELETE', 'POST']))
  }

  const auth = await requireAuthenticatedUser(request, env)
  if (auth.error) {
    return withAccountHeaders(auth.error)
  }

  let body
  try {
    body = await readJsonBody(request)
  } catch (error) {
    return invalidBodyResponse(error)
  }

  if (!validateDeleteCloudDataConfirmation(body.confirmation)) {
    return withAccountHeaders(
      jsonError(
        400,
        'invalid_confirmation',
        'Type DELETE CLOUD DATA to confirm cloud library deletion.',
      ),
    )
  }

  const rateLimitError = await enforceDestructiveRateLimit(env.DB, auth.user.id)
  if (rateLimitError) {
    return withAccountHeaders(rateLimitError)
  }

  try {
    const result = await deleteAllUserCloudData(env.DB, env.ARTWORK_BUCKET ?? null, auth.user.id)

    return withAccountHeaders(
      jsonOk({
        ok: true,
        deleted: true,
        ...result,
      }),
    )
  } catch (error) {
    logError('account.delete_cloud_data', error, { userId: auth.user.id })
    return withAccountHeaders(
      jsonError(500, 'service_unavailable', 'Could not delete cloud data. Please try again.'),
    )
  }
}

async function handleDeleteAccount(request, env) {
  // Accept POST as well as DELETE: iOS Safari / Home Screen can strip DELETE bodies.
  if (request.method !== 'DELETE' && request.method !== 'POST') {
    return withAccountHeaders(methodNotAllowed(['DELETE', 'POST']))
  }

  const auth = await requireAuthenticatedUser(request, env)
  if (auth.error) {
    return withAccountHeaders(auth.error)
  }

  let body
  try {
    body = await readJsonBody(request)
  } catch (error) {
    return invalidBodyResponse(error)
  }

  if (!validateDeleteAccountConfirmation(body.confirmation)) {
    return withAccountHeaders(
      jsonError(
        400,
        'invalid_confirmation',
        'Type DELETE MY ACCOUNT to confirm permanent account deletion.',
      ),
    )
  }

  const rateLimitError = await enforceDestructiveRateLimit(env.DB, auth.user.id)
  if (rateLimitError) {
    return withAccountHeaders(rateLimitError)
  }

  try {
    const result = await deleteUserAccount(
      env.DB,
      env.ARTWORK_BUCKET ?? null,
      auth.user.id,
      auth.user.email,
    )

    return withAccountHeaders(jsonOk({ ok: true, deleted: true, ...result }), {
      'Set-Cookie': buildClearSessionCookie(request, env),
    })
  } catch (error) {
    logError('account.delete', error, { userId: auth.user.id })
    return withAccountHeaders(
      jsonError(500, 'service_unavailable', 'Could not delete account. Please try again.'),
    )
  }
}

export async function handleAccountRoute(request, env, path) {
  if (path === '/api/account/cloud-data') {
    return handleDeleteCloudData(request, env)
  }

  if (path === '/api/account') {
    return handleDeleteAccount(request, env)
  }

  return null
}
