import { apiFetch } from '../utils/api'
import { ApiError } from '../utils/api'

async function uploadBinary(path, blob, contentType) {
  const response = await fetch(path, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': contentType,
    },
    body: blob,
  })

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

export async function uploadCloudFolders(folders) {
  return apiFetch('/api/cloud/folders', {
    method: 'PUT',
    body: JSON.stringify({ folders }),
  })
}

export async function uploadCloudArtworks(artworks) {
  return apiFetch('/api/cloud/artworks', {
    method: 'PUT',
    body: JSON.stringify({ artworks }),
  })
}

export async function uploadCloudArtworkOriginal(artworkId, blob) {
  const contentType = blob.type || 'image/jpeg'
  return uploadBinary(`/api/cloud/artworks/${encodeURIComponent(artworkId)}/original`, blob, contentType)
}

export async function uploadCloudArtworkThumbnail(artworkId, blob) {
  const contentType = blob.type || 'image/jpeg'
  return uploadBinary(`/api/cloud/artworks/${encodeURIComponent(artworkId)}/thumbnail`, blob, contentType)
}
