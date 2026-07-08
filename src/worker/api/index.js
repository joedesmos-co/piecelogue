import { notFound } from '../http.js'
import { handleAuthRoute } from './auth.js'
import { handleHealth } from './health.js'

export async function handleApi(request, env) {
  const url = new URL(request.url)
  const path = url.pathname

  if (path === '/api/health') {
    return handleHealth(request)
  }

  const authResponse = await handleAuthRoute(request, env, path)
  if (authResponse) {
    return authResponse
  }

  return notFound()
}
