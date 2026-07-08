import { getSessionTokenFromRequest } from './cookies.js'
import { getUserProfileById } from './profile.js'
import { getActiveSessionForToken } from './sessions.js'
import { jsonError } from '../http.js'

export async function requireAuthenticatedUser(request, env) {
  if (!env.DB) {
    return { error: jsonError(503, 'service_unavailable', 'Service is temporarily unavailable.') }
  }

  const sessionToken = getSessionTokenFromRequest(request, env)
  if (!sessionToken) {
    return { error: jsonError(401, 'unauthorized', 'Sign in required.') }
  }

  const sessionUser = await getActiveSessionForToken(env.DB, sessionToken)
  if (!sessionUser) {
    return { error: jsonError(401, 'unauthorized', 'Sign in required.') }
  }

  const profile = await getUserProfileById(env.DB, sessionUser.id)
  if (!profile) {
    return { error: jsonError(401, 'unauthorized', 'Sign in required.') }
  }

  return { user: profile }
}
