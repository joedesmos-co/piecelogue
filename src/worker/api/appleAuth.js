import { VERIFY_REDIRECT_HEADERS } from '../auth/constants.js'
import {
  buildClearOAuthStateCookie,
  buildOAuthStateCookie,
  createOAuthState,
  getOAuthNonceFromRequest,
  validateOAuthState,
} from '../auth/oauthState.js'
import { buildSessionCookie } from '../auth/cookies.js'
import { normalizeEmail } from '../auth/email.js'
import { verifyAppleIdToken } from '../auth/appleIdToken.js'
import {
  buildAppleAuthUrl,
  createAppleClientSecretFromEnv,
  exchangeAppleCode,
  getAppleRedirectUri,
  isAppleOAuthConfigured,
  parseAppleUserField,
} from '../auth/appleOAuth.js'
import { getAppOrigin } from '../auth/googleOAuth.js'
import {
  createSession,
  findOrCreateVerifiedUser,
  updateUserDisplayNameIfEmpty,
} from '../auth/sessions.js'
import { methodNotAllowed } from '../http.js'

const APPLE_OAUTH_COOKIE_OPTIONS = { sameSite: 'None' }

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

function clearAppleOAuthStateCookie(request, env) {
  return buildClearOAuthStateCookie(request, env, APPLE_OAUTH_COOKIE_OPTIONS)
}

export async function handleAppleStart(request, env) {
  if (request.method !== 'GET') {
    return methodNotAllowed(['GET'])
  }

  if (!env.DB) {
    console.error('[Piecelogue] D1 binding DB is missing.')
    return redirectToApp(env, request, 'error')
  }

  if (!isAppleOAuthConfigured(env)) {
    console.error('[Piecelogue] Apple OAuth is not configured.')
    return redirectToApp(env, request, 'error')
  }

  const state = createOAuthState()
  const nonce = createOAuthState()
  const redirectUri = getAppleRedirectUri(env, request)
  const authUrl = buildAppleAuthUrl({
    clientId: env.APPLE_CLIENT_ID,
    redirectUri,
    state,
    nonce,
  })

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl,
      'Set-Cookie': buildOAuthStateCookie(state, request, env, {
        ...APPLE_OAUTH_COOKIE_OPTIONS,
        nonce,
      }),
      ...VERIFY_REDIRECT_HEADERS,
    },
  })
}

async function readAppleCallbackForm(request) {
  const contentType = request.headers.get('Content-Type') || ''
  if (!contentType.includes('application/x-www-form-urlencoded')) {
    return null
  }

  const body = await request.text()
  const params = new URLSearchParams(body)

  return {
    code: params.get('code')?.trim() || null,
    state: params.get('state')?.trim() || null,
    idToken: params.get('id_token')?.trim() || null,
    user: params.get('user')?.trim() || null,
    error: params.get('error')?.trim() || null,
  }
}

export async function handleAppleCallback(request, env) {
  if (request.method !== 'POST') {
    return methodNotAllowed(['POST'])
  }

  if (!env.DB) {
    console.error('[Piecelogue] D1 binding DB is missing.')
    return redirectToApp(env, request, 'error')
  }

  if (!isAppleOAuthConfigured(env)) {
    console.error('[Piecelogue] Apple OAuth is not configured.')
    return redirectToApp(env, request, 'error')
  }

  const form = await readAppleCallbackForm(request)
  if (!form) {
    console.error('[Piecelogue] Apple OAuth callback had invalid form body.')
    return redirectToApp(env, request, 'error', {
      'Set-Cookie': clearAppleOAuthStateCookie(request, env),
    })
  }

  if (form.error) {
    console.error('[Piecelogue] Apple OAuth denied or failed:', form.error)
    return redirectToApp(env, request, 'error', {
      'Set-Cookie': clearAppleOAuthStateCookie(request, env),
    })
  }

  if (!form.code || !form.state || !validateOAuthState(request, env, form.state)) {
    console.error('[Piecelogue] Apple OAuth callback failed state validation.')
    return redirectToApp(env, request, 'error', {
      'Set-Cookie': clearAppleOAuthStateCookie(request, env),
    })
  }

  try {
    const redirectUri = getAppleRedirectUri(env, request)
    const clientSecret = await createAppleClientSecretFromEnv(env)
    const tokenResponse = await exchangeAppleCode({
      clientId: env.APPLE_CLIENT_ID,
      clientSecret,
      code: form.code,
      redirectUri,
    })

    const nonce = getOAuthNonceFromRequest(request, env)
    const claims = await verifyAppleIdToken(tokenResponse.id_token, {
      clientId: env.APPLE_CLIENT_ID,
      nonce,
    })

    const email = normalizeEmail(claims.email)
    if (!email) {
      throw new Error('Apple account did not provide an email address.')
    }

    const user = await findOrCreateVerifiedUser(env.DB, email)
    const { displayName } = parseAppleUserField(form.user)
    await updateUserDisplayNameIfEmpty(env.DB, user.id, displayName)

    const session = await createSession(env.DB, user.id)
    const origin = getAppOrigin(env, request)
    const headers = new Headers({
      Location: `${origin}/app?auth=success&view=profile`,
      ...VERIFY_REDIRECT_HEADERS,
    })
    headers.append('Set-Cookie', buildSessionCookie(session.rawToken, request, env))
    headers.append('Set-Cookie', clearAppleOAuthStateCookie(request, env))

    return new Response(null, {
      status: 302,
      headers,
    })
  } catch (error) {
    console.error('[Piecelogue] Apple OAuth callback failed:', error?.message || error)
    return redirectToApp(env, request, 'error', {
      'Set-Cookie': clearAppleOAuthStateCookie(request, env),
    })
  }
}
