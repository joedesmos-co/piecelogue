import { apiFetch } from '../utils/api.js'
import { ApiError } from '../utils/api.js'
import { fetchWithTimeout, runWithWatchdog } from '../utils/fetchWithTimeout.js'
import { IMAGE_UPLOAD_TIMEOUT_MS, METADATA_UPLOAD_TIMEOUT_MS } from '../sync/constants.js'
import {
  buildSafeUploadDiagnostic,
  createUploadRequestId,
  logUploadEnd,
  logUploadFailure,
  logUploadStart,
} from '../sync/uploadDiagnostics.js'

function combineSignals(primary, secondary) {
  if (!primary) {
    return secondary
  }

  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([primary, secondary])
  }

  const controller = new AbortController()
  const abort = () => controller.abort()
  if (primary.aborted || secondary.aborted) {
    abort()
  } else {
    primary.addEventListener('abort', abort, { once: true })
    secondary.addEventListener('abort', abort, { once: true })
  }
  return controller.signal
}

export async function uploadBinary(path, body, options = {}) {
  const requestId = options.requestId || createUploadRequestId()
  const diagnostic = buildSafeUploadDiagnostic({
    ...options,
    requestId,
  })
  const requestController = new AbortController()

  logUploadStart(diagnostic)

  try {
    const data = await runWithWatchdog(
      async () => {
        const response = await fetchWithTimeout(
          path,
          {
            method: 'PUT',
            credentials: 'include',
            headers: {
              'Content-Type': options.contentType,
              'X-Piecelogue-Upload-Id': requestId,
            },
            body,
            signal: combineSignals(options.signal, requestController.signal),
          },
          IMAGE_UPLOAD_TIMEOUT_MS,
        )

        let responseData = null
        const responseContentType = response.headers.get('Content-Type') || ''
        if (responseContentType.includes('application/json')) {
          responseData = await response.json()
        }

        if (!response.ok) {
          const message = responseData?.error?.message || `Request failed (${response.status})`
          throw new ApiError(message, responseData?.error?.code, response.status)
        }

        if (responseData?.ok === false) {
          const message = responseData?.error?.message || 'Request failed'
          throw new ApiError(message, responseData?.error?.code, response.status)
        }

        return responseData
      },
      {
        timeoutMs: IMAGE_UPLOAD_TIMEOUT_MS + 1000,
        signal: options.signal,
        timeoutMessage: 'Image upload watchdog timed out. Retry when your connection is stable.',
      },
    )

    logUploadEnd(diagnostic)
    return data
  } catch (error) {
    requestController.abort()
    logUploadFailure(diagnostic, error)
    throw error
  }
}

export async function fetchCloudStatus() {
  const data = await apiFetch('/api/cloud/status')
  return data.status ?? null
}

export async function fetchCloudLibrary() {
  const data = await apiFetch('/api/cloud/library')
  return data.library ?? { folders: [], artworks: [] }
}

export async function downloadCloudArtworkImage(artworkId, imageType) {
  const response = await fetchWithTimeout(
    `/api/cloud/artworks/${encodeURIComponent(artworkId)}/${imageType}`,
    { credentials: 'include' },
    IMAGE_UPLOAD_TIMEOUT_MS,
  )

  if (!response.ok) {
    let data = null
    const contentType = response.headers.get('Content-Type') || ''
    if (contentType.includes('application/json')) {
      data = await response.json()
    }
    const message = data?.error?.message || `Image download failed (${response.status})`
    throw new ApiError(message, data?.error?.code, response.status)
  }

  return response.blob()
}

export async function deleteCloudFolder(folderId, options = {}) {
  return apiFetch(
    `/api/cloud/folders/${encodeURIComponent(folderId)}`,
    {
      method: 'DELETE',
      signal: options.signal,
    },
    METADATA_UPLOAD_TIMEOUT_MS,
  )
}

export async function deleteCloudArtwork(artworkId, options = {}) {
  return apiFetch(
    `/api/cloud/artworks/${encodeURIComponent(artworkId)}`,
    {
      method: 'DELETE',
      signal: options.signal,
    },
    METADATA_UPLOAD_TIMEOUT_MS,
  )
}

export async function uploadCloudFolders(folders, options = {}) {
  return apiFetch(
    '/api/cloud/folders',
    {
      method: 'PUT',
      body: JSON.stringify({ folders }),
      signal: options.signal,
    },
    METADATA_UPLOAD_TIMEOUT_MS,
  )
}

export async function uploadCloudArtworks(artworks, options = {}) {
  return apiFetch(
    '/api/cloud/artworks',
    {
      method: 'PUT',
      body: JSON.stringify({ artworks }),
      signal: options.signal,
    },
    METADATA_UPLOAD_TIMEOUT_MS,
  )
}

export async function uploadCloudArtworkOriginal(artworkId, body, options = {}) {
  return uploadBinary(
    `/api/cloud/artworks/${encodeURIComponent(artworkId)}/original`,
    body,
    {
      ...options,
      artworkId,
      stage: 'original',
    },
  )
}

export async function uploadCloudArtworkThumbnail(artworkId, body, options = {}) {
  return uploadBinary(
    `/api/cloud/artworks/${encodeURIComponent(artworkId)}/thumbnail`,
    body,
    {
      ...options,
      artworkId,
      stage: 'thumbnail',
    },
  )
}
