import { notFound } from '../http.js'
import { handleAccountRoute } from './account.js'
import { handleAuthRoute } from './auth.js'
import { handleCloudRoute } from './cloud.js'
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

  const accountResponse = await handleAccountRoute(request, env, path)
  if (accountResponse) {
    return accountResponse
  }

  const cloudResponse = await handleCloudRoute(request, env, path)
  if (cloudResponse) {
    return cloudResponse
  }

  return notFound()
}
