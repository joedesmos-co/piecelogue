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

export async function fetchCloudLibrary() {
  const data = await apiFetch('/api/cloud/library')
  return data.library ?? { folders: [], artworks: [] }
}

export async function downloadCloudArtworkImage(artworkId, imageType) {
  const response = await fetch(
    `/api/cloud/artworks/${encodeURIComponent(artworkId)}/${imageType}`,
    { credentials: 'include' },
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

export async function deleteCloudFolder(folderId) {
  return apiFetch(`/api/cloud/folders/${encodeURIComponent(folderId)}`, {
    method: 'DELETE',
  })
}

export async function deleteCloudArtwork(artworkId) {
  return apiFetch(`/api/cloud/artworks/${encodeURIComponent(artworkId)}`, {
    method: 'DELETE',
  })
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
