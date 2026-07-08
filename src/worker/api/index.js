import { notFound } from '../http.js'
import { handleAuthRoute } from './auth.js'
import { handleHealth } from './health.js'
import { handleProfileRoute } from './profile.js'

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

  const profileResponse = await handleProfileRoute(request, env, path)
  if (profileResponse) {
    return profileResponse
  }

  return notFound()
}
