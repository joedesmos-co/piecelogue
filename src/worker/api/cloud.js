import { AUTH_CACHE_HEADERS } from '../auth/constants.js'
import { CLOUD_MAX_IMAGE_BYTES, CLOUD_MAX_JSON_BYTES, CLOUD_MAX_THUMBNAIL_BYTES, ALLOWED_IMAGE_TYPES } from '../cloud/constants.js'
import {
  assertArtworkOwnedByUser,
  getArtworkImageObject,
  getCloudLibrary,
  getCloudStatus,
  saveArtworkOriginal,
  saveArtworkThumbnail,
  softDeleteCloudArtwork,
  softDeleteCloudFolder,
  upsertCloudArtworks,
  upsertCloudFolders,
} from '../cloud/storage.js'
import { requireAuthenticatedUser } from '../auth/requireUser.js'
import { logError, logInfo } from '../log.js'
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

async function readJsonBody(request, maxBytes) {
  const contentLength = Number(request.headers.get('Content-Length') || 0)
  if (contentLength > maxBytes) {
    throw new BodyTooLargeError()
  }

  const text = await request.text()
  if (text.length > maxBytes) {
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

function getUploadRequestId(request) {
  const value = request.headers.get('X-Piecelogue-Upload-Id')?.trim()
  if (!value || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) {
    return 'missing'
  }
  return value
}

export async function readImageBodyWithLimit(request, maxBytes) {
  const contentLength = Number(request.headers.get('Content-Length') || 0)
  if (contentLength > maxBytes) {
    throw new BodyTooLargeError()
  }

  if (!request.body) {
    return new Uint8Array()
  }

  const reader = request.body.getReader()
  const chunks = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value)
      totalBytes += chunk.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel()
        throw new BodyTooLargeError()
      }
      chunks.push(chunk)
    }
  } finally {
    reader.releaseLock()
  }

  const body = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

function withCloudHeaders(response) {
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

function parseArtworkImagePath(pathname, suffix) {
  const pattern = new RegExp(`^/api/cloud/artworks/([^/]+)/${suffix}$`)
  const match = pathname.match(pattern)
  return match?.[1] ?? null
}

function parseCloudResourcePath(pathname, resource) {
  const pattern = new RegExp(`^/api/cloud/${resource}/([^/]+)$`)
  const match = pathname.match(pattern)
  return match?.[1] ?? null
}

async function handleDeleteFolder(request, env, folderId) {
  const auth = await requireAuthenticatedUser(request, env)
  if (auth.error) {
    return withCloudHeaders(auth.error)
  }

  const result = await softDeleteCloudFolder(env.DB, auth.user.id, folderId)
  if (!result) {
    return withCloudHeaders(jsonError(404, 'not_found', 'Folder not found.'))
  }

  return withCloudHeaders(
    jsonOk({
      ok: true,
      folderId,
      deletedAt: result.deletedAt,
      alreadyDeleted: Boolean(result.alreadyDeleted),
    }),
  )
}

async function handleDeleteArtwork(request, env, artworkId) {
  const auth = await requireAuthenticatedUser(request, env)
  if (auth.error) {
    return withCloudHeaders(auth.error)
  }

  if (!env.ARTWORK_BUCKET) {
    return withCloudHeaders(jsonError(503, 'service_unavailable', 'Cloud storage is not available.'))
  }

  const result = await softDeleteCloudArtwork(
    env.DB,
    env.ARTWORK_BUCKET,
    auth.user.id,
    artworkId,
  )

  if (!result) {
    return withCloudHeaders(jsonError(404, 'not_found', 'Artwork not found.'))
  }

  return withCloudHeaders(
    jsonOk({
      ok: true,
      artworkId,
      deletedAt: result.deletedAt,
      alreadyDeleted: Boolean(result.alreadyDeleted),
      r2Deleted: result.r2Deleted ?? 0,
    }),
  )
}

async function handlePutFolders(request, env) {
  const auth = await requireAuthenticatedUser(request, env)
  if (auth.error) {
    return withCloudHeaders(auth.error)
  }

  let body
  try {
    body = await readJsonBody(request, CLOUD_MAX_JSON_BYTES)
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return withCloudHeaders(jsonError(413, 'payload_too_large', 'Request body is too large.'))
    }
    if (error instanceof InvalidJsonError) {
      return withCloudHeaders(jsonError(400, 'invalid_json', 'Invalid JSON body.'))
    }
    throw error
  }

  try {
    const result = await upsertCloudFolders(env.DB, auth.user.id, body.folders)
    return withCloudHeaders(jsonOk({ ok: true, ...result }))
  } catch (error) {
    return withCloudHeaders(
      jsonError(400, 'invalid_folder', error.message || 'Invalid folder data.'),
    )
  }
}

async function handlePutArtworks(request, env) {
  const auth = await requireAuthenticatedUser(request, env)
  if (auth.error) {
    return withCloudHeaders(auth.error)
  }

  let body
  try {
    body = await readJsonBody(request, CLOUD_MAX_JSON_BYTES)
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return withCloudHeaders(jsonError(413, 'payload_too_large', 'Request body is too large.'))
    }
    if (error instanceof InvalidJsonError) {
      return withCloudHeaders(jsonError(400, 'invalid_json', 'Invalid JSON body.'))
    }
    throw error
  }

  try {
    const result = await upsertCloudArtworks(env.DB, auth.user.id, body.artworks)
    return withCloudHeaders(jsonOk({ ok: true, ...result }))
  } catch (error) {
    return withCloudHeaders(
      jsonError(400, 'invalid_artwork', error.message || 'Invalid artwork data.'),
    )
  }
}

async function handlePutArtworkImage(request, env, artworkId, imageType) {
  const requestId = getUploadRequestId(request)
  const routeStartedAt = Date.now()
  const baseDiagnostic = { requestId, artworkId, imageType }
  logInfo('cloud.image_upload.worker.start', 'Upload route received.', baseDiagnostic)

  const auth = await requireAuthenticatedUser(request, env)
  if (auth.error) {
    logInfo('cloud.image_upload.worker.end', 'Authentication rejected upload.', {
      ...baseDiagnostic,
      elapsedMs: Date.now() - routeStartedAt,
      status: auth.error.status,
    })
    return withCloudHeaders(auth.error)
  }

  if (!env.ARTWORK_BUCKET) {
    logInfo('cloud.image_upload.worker.end', 'Cloud storage unavailable.', {
      ...baseDiagnostic,
      elapsedMs: Date.now() - routeStartedAt,
      status: 503,
    })
    return withCloudHeaders(jsonError(503, 'service_unavailable', 'Cloud storage is not available.'))
  }

  const owned = await assertArtworkOwnedByUser(env.DB, auth.user.id, artworkId)
  if (!owned) {
    logInfo('cloud.image_upload.worker.end', 'Artwork was not found.', {
      ...baseDiagnostic,
      elapsedMs: Date.now() - routeStartedAt,
      status: 404,
    })
    return withCloudHeaders(jsonError(404, 'not_found', 'Artwork not found.'))
  }

  const contentType = request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase()
  if (!contentType || !ALLOWED_IMAGE_TYPES.has(contentType)) {
    logInfo('cloud.image_upload.worker.end', 'Unsupported image content type.', {
      ...baseDiagnostic,
      contentType: contentType || null,
      elapsedMs: Date.now() - routeStartedAt,
      status: 400,
    })
    return withCloudHeaders(
      jsonError(400, 'invalid_content_type', 'Image must be JPEG, PNG, WebP, or GIF.'),
    )
  }

  const maxBytes = imageType === 'thumbnail' ? CLOUD_MAX_THUMBNAIL_BYTES : CLOUD_MAX_IMAGE_BYTES
  const bodyReadStartedAt = Date.now()
  logInfo('cloud.image_upload.worker.body.start', 'Reading upload body.', {
    ...baseDiagnostic,
    contentType,
    contentLength: request.headers.get('Content-Length') || null,
  })

  let body
  try {
    body = await readImageBodyWithLimit(request, maxBytes)
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      logInfo('cloud.image_upload.worker.body.error', 'Upload body exceeded size limit.', {
        ...baseDiagnostic,
        contentType,
        elapsedMs: Date.now() - bodyReadStartedAt,
        status: 413,
      })
      return withCloudHeaders(jsonError(413, 'payload_too_large', 'Image is too large.'))
    }
    logError('cloud.image_upload.worker.body.error', error, {
      ...baseDiagnostic,
      contentType,
      elapsedMs: Date.now() - bodyReadStartedAt,
    })
    return withCloudHeaders(jsonError(400, 'invalid_image', 'Could not read image upload.'))
  }

  logInfo('cloud.image_upload.worker.body.end', 'Upload body read.', {
    ...baseDiagnostic,
    contentType,
    byteSize: body.byteLength,
    elapsedMs: Date.now() - bodyReadStartedAt,
  })

  if (body.byteLength > maxBytes) {
    logInfo('cloud.image_upload.worker.end', 'Upload body exceeded size limit.', {
      ...baseDiagnostic,
      contentType,
      byteSize: body.byteLength,
      elapsedMs: Date.now() - routeStartedAt,
      status: 413,
    })
    return withCloudHeaders(jsonError(413, 'payload_too_large', 'Image is too large.'))
  }

  if (body.byteLength === 0) {
    logInfo('cloud.image_upload.worker.end', 'Upload body was empty.', {
      ...baseDiagnostic,
      contentType,
      byteSize: 0,
      elapsedMs: Date.now() - routeStartedAt,
      status: 400,
    })
    return withCloudHeaders(jsonError(400, 'invalid_image', 'Image body is empty.'))
  }

  const rateLimit = await checkRateLimit(
    env.DB,
    buildUserRateLimitKey('cloud:image', auth.user.id),
    RATE_LIMITS.CLOUD_IMAGE_UPLOAD,
  )
  if (!rateLimit.allowed) {
    logInfo('cloud.image_upload.worker.end', 'Image upload was rate limited.', {
      ...baseDiagnostic,
      contentType,
      byteSize: body.byteLength,
      elapsedMs: Date.now() - routeStartedAt,
      status: 429,
    })
    return withCloudHeaders(
      jsonError(429, 'rate_limit', 'Too many image uploads. Please wait and try again.'),
    )
  }

  try {
    let storageStartedAt = null
    const storageHooks = {
      onStorageStart() {
        storageStartedAt = Date.now()
        logInfo('cloud.image_upload.worker.storage.start', 'Starting object storage write.', {
          ...baseDiagnostic,
          contentType,
          byteSize: body.byteLength,
        })
      },
      onStorageEnd() {
        logInfo('cloud.image_upload.worker.storage.end', 'Object storage write completed.', {
          ...baseDiagnostic,
          contentType,
          byteSize: body.byteLength,
          elapsedMs: storageStartedAt ? Date.now() - storageStartedAt : null,
        })
      },
    }
    const result =
      imageType === 'thumbnail'
        ? await saveArtworkThumbnail(
            env.DB,
            env.ARTWORK_BUCKET,
            auth.user.id,
            artworkId,
            body,
            contentType,
            storageHooks,
          )
        : await saveArtworkOriginal(
            env.DB,
            env.ARTWORK_BUCKET,
            auth.user.id,
            artworkId,
            body,
            contentType,
            storageHooks,
          )

    logInfo('cloud.image_upload.worker.end', 'Upload completed.', {
      ...baseDiagnostic,
      contentType,
      byteSize: body.byteLength,
      elapsedMs: Date.now() - routeStartedAt,
      status: 200,
    })
    return withCloudHeaders(
      jsonOk({
        ok: true,
        artworkId,
        updatedAt: result.updatedAt,
      }),
    )
  } catch (error) {
    logError('cloud.image_upload.worker.error', error, {
      ...baseDiagnostic,
      contentType,
      byteSize: body.byteLength,
      elapsedMs: Date.now() - routeStartedAt,
      status: 500,
    })
    return withCloudHeaders(
      jsonError(500, 'upload_failed', 'Failed to save image to cloud storage.'),
    )
  }
}

async function handleGetLibrary(request, env) {
  const auth = await requireAuthenticatedUser(request, env)
  if (auth.error) {
    return withCloudHeaders(auth.error)
  }

  const library = await getCloudLibrary(env.DB, auth.user.id)
  return withCloudHeaders(
    jsonOk({
      ok: true,
      library,
    }),
  )
}

async function handleGetArtworkImage(request, env, artworkId, imageType) {
  const auth = await requireAuthenticatedUser(request, env)
  if (auth.error) {
    return withCloudHeaders(auth.error)
  }

  if (!env.ARTWORK_BUCKET) {
    return withCloudHeaders(jsonError(503, 'service_unavailable', 'Cloud storage is not available.'))
  }

  const object = await getArtworkImageObject(
    env.DB,
    env.ARTWORK_BUCKET,
    auth.user.id,
    artworkId,
    imageType,
  )

  if (!object) {
    return withCloudHeaders(jsonError(404, 'not_found', 'Image not found.'))
  }

  const headers = new Headers()
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream')
  headers.set('Content-Length', String(object.size))
  for (const [key, value] of Object.entries(AUTH_CACHE_HEADERS)) {
    headers.set(key, value)
  }

  return new Response(object.body, { status: 200, headers })
}

async function handleGetStatus(request, env) {
  if (request.method !== 'GET') {
    return methodNotAllowed(['GET'])
  }

  const auth = await requireAuthenticatedUser(request, env)
  if (auth.error) {
    return withCloudHeaders(auth.error)
  }

  const status = await getCloudStatus(env.DB, auth.user.id)
  return withCloudHeaders(
    jsonOk({
      ok: true,
      status,
    }),
  )
}

export async function handleCloudRoute(request, env, path) {
  if (path === '/api/cloud/folders' && request.method === 'PUT') {
    return handlePutFolders(request, env)
  }

  if (path === '/api/cloud/artworks' && request.method === 'PUT') {
    return handlePutArtworks(request, env)
  }

  if (path === '/api/cloud/status' && request.method === 'GET') {
    return handleGetStatus(request, env)
  }

  if (path === '/api/cloud/library' && request.method === 'GET') {
    return handleGetLibrary(request, env)
  }

  const folderId = parseCloudResourcePath(path, 'folders')
  if (folderId && request.method === 'DELETE') {
    return handleDeleteFolder(request, env, folderId)
  }

  const artworkId = parseCloudResourcePath(path, 'artworks')
  if (artworkId && request.method === 'DELETE') {
    return handleDeleteArtwork(request, env, artworkId)
  }

  const originalArtworkId = parseArtworkImagePath(path, 'original')
  if (originalArtworkId && request.method === 'PUT') {
    return handlePutArtworkImage(request, env, originalArtworkId, 'original')
  }
  if (originalArtworkId && request.method === 'GET') {
    return handleGetArtworkImage(request, env, originalArtworkId, 'original')
  }

  const thumbnailArtworkId = parseArtworkImagePath(path, 'thumbnail')
  if (thumbnailArtworkId && request.method === 'PUT') {
    return handlePutArtworkImage(request, env, thumbnailArtworkId, 'thumbnail')
  }
  if (thumbnailArtworkId && request.method === 'GET') {
    return handleGetArtworkImage(request, env, thumbnailArtworkId, 'thumbnail')
  }

  return null
}
