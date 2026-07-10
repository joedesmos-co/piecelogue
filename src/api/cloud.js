import { apiFetch } from '../utils/api'
import { ApiError } from '../utils/api'
import { fetchWithTimeout } from '../utils/fetchWithTimeout'
import { IMAGE_UPLOAD_TIMEOUT_MS, METADATA_UPLOAD_TIMEOUT_MS } from '../sync/constants'

async function uploadBinary(path, blob, contentType, signal) {
  const response = await fetchWithTimeout(
    path,
    {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': contentType,
      },
      body: blob,
      signal,
    },
    IMAGE_UPLOAD_TIMEOUT_MS,
  )

  let data = null
  const responseContentType = response.headers.get('Content-Type') || ''
  if (responseContentType.includes('application/json')) {
    data = await response.json()
  }

  if (!response.ok) {
    const message = data?.error?.message || `Request failed (${response.status})`
    throw new ApiError(message, data?.error?.code, response.status)
  }

  if (data?.ok === false) {
    const message = data?.error?.message || 'Request failed'
    throw new ApiError(message, data?.error?.code, response.status)
  }

  return data
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

export async function uploadCloudArtworkOriginal(artworkId, blob, options = {}) {
  const contentType = options.contentType || blob.type || 'image/jpeg'
  return uploadBinary(
    `/api/cloud/artworks/${encodeURIComponent(artworkId)}/original`,
    blob,
    contentType,
    options.signal,
  )
}

export async function uploadCloudArtworkThumbnail(artworkId, blob, options = {}) {
  const contentType = options.contentType || blob.type || 'image/jpeg'
  return uploadBinary(
    `/api/cloud/artworks/${encodeURIComponent(artworkId)}/thumbnail`,
    blob,
    contentType,
    options.signal,
  )
}
