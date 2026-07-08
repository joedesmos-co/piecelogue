import { VERIFY_REDIRECT_HEADERS } from '../auth/constants.js'
import {
  buildClearOAuthStateCookie,
  buildOAuthStateCookie,
  createOAuthState,
  validateOAuthState,
} from '../auth/oauthState.js'
import { buildSessionCookie } from '../auth/cookies.js'
import { normalizeEmail } from '../auth/email.js'
import {
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  fetchGoogleUserInfo,
  getAppOrigin,
  getGoogleRedirectUri,
  isGoogleOAuthConfigured,
} from '../auth/googleOAuth.js'
import { createSession, findOrCreateVerifiedUser } from '../auth/sessions.js'
import { methodNotAllowed } from '../http.js'

function redirectToApp(env, request, status, extraHeaders = {}) {
  const origin = getAppOrigin(env, request)
  const headers = new Headers({
    Location: `${origin}/app?auth=${status}`,
    ...VERIFY_REDIRECT_HEADERS,
    ...extraHeaders,
  })

  return new Response(null, {
    status: 302,
    headers,
  })
}

export async function handleGoogleStart(request, env) {
  if (request.method !== 'GET') {
    return methodNotAllowed(['GET'])
  }

  if (!env.DB) {
    console.error('[Piecelogue] D1 binding DB is missing.')
    return redirectToApp(env, request, 'error')
  }

  if (!isGoogleOAuthConfigured(env)) {
    console.error('[Piecelogue] Google OAuth is not configured.')
    return redirectToApp(env, request, 'error')
  }

  const state = createOAuthState()
  const redirectUri = getGoogleRedirectUri(env, request)
  const authUrl = buildGoogleAuthUrl({
    clientId: env.GOOGLE_CLIENT_ID,
    redirectUri,
    state,
  })

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl,
      'Set-Cookie': buildOAuthStateCookie(state, request, env),
      ...VERIFY_REDIRECT_HEADERS,
    },
  })
}

export async function handleGoogleCallback(request, env) {
  if (request.method !== 'GET') {
    return methodNotAllowed(['GET'])
  }

  if (!env.DB) {
    console.error('[Piecelogue] D1 binding DB is missing.')
    return redirectToApp(env, request, 'error')
  }

  if (!isGoogleOAuthConfigured(env)) {
    console.error('[Piecelogue] Google OAuth is not configured.')
    return redirectToApp(env, request, 'error')
  }

  const url = new URL(request.url)
  const oauthError = url.searchParams.get('error')
  if (oauthError) {
    console.error('[Piecelogue] Google OAuth denied or failed:', oauthError)
    return redirectToApp(env, request, 'error', {
      'Set-Cookie': buildClearOAuthStateCookie(request, env),
    })
  }

  const code = url.searchParams.get('code')?.trim()
  const state = url.searchParams.get('state')?.trim()

  if (!code || !validateOAuthState(request, env, state)) {
    console.error('[Piecelogue] Google OAuth callback failed state validation.')
    return redirectToApp(env, request, 'error', {
      'Set-Cookie': buildClearOAuthStateCookie(request, env),
    })
  }

  try {
    const redirectUri = getGoogleRedirectUri(env, request)
    const tokenResponse = await exchangeGoogleCode({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      code,
      redirectUri,
    })

    const profile = await fetchGoogleUserInfo(tokenResponse.access_token)
    if (!profile.email_verified) {
      throw new Error('Google account email is not verified.')
    }

    const email = normalizeEmail(profile.email)
    if (!email) {
      throw new Error('Google account did not provide an email address.')
    }

    const user = await findOrCreateVerifiedUser(env.DB, email)
    const session = await createSession(env.DB, user.id)
    const origin = getAppOrigin(env, request)
    const headers = new Headers({
      Location: `${origin}/app?auth=success&view=profile`,
      ...VERIFY_REDIRECT_HEADERS,
    })
    headers.append('Set-Cookie', buildSessionCookie(session.rawToken, request, env))
    headers.append('Set-Cookie', buildClearOAuthStateCookie(request, env))

    return new Response(null, {
      status: 302,
      headers,
    })
  } catch (error) {
    console.error('[Piecelogue] Google OAuth callback failed:', error?.message || error)
    return redirectToApp(env, request, 'error', {
      'Set-Cookie': buildClearOAuthStateCookie(request, env),
    })
  }
}
