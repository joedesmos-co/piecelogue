import { notFound } from '../http'
import { handleHealth } from './health'

export async function handleApi(request) {
  const url = new URL(request.url)
  const path = url.pathname

  // ---- Health ----
  if (path === '/api/health') {
    return handleHealth(request)
  }

  // TODO: Add future API routes here (no auth / no sync yet).
  // Examples:
  // if (path === '/api/folders') return handleFolders(request)
  // if (path === '/api/artworks') return handleArtworks(request)

  return notFound()
}

