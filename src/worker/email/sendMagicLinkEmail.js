function getAppOrigin(env, request) {
  if (request && isDevMode(env)) {
    return new URL(request.url).origin
  }

  return (env.APP_ORIGIN || 'https://piecelogue.com').replace(/\/$/, '')
}

function getFromAddress(env) {
  return env.AUTH_FROM_EMAIL || env.EMAIL_FROM || null
}

export function isDevMode(env) {
  const flag = env?.AUTH_DEV_MODE

  if (flag === true || flag === 1) {
    return true
  }

  if (typeof flag === 'string') {
    const normalized = flag.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return true
    }
  }

  if (env?.ENVIRONMENT === 'development') {
    return true
  }

  return false
}

function buildMagicLinkUrl(env, rawToken, request) {
  const origin = getAppOrigin(env, request)
  return `${origin}/api/auth/verify?token=${encodeURIComponent(rawToken)}`
}

/**
 * Sends a magic-link email via the Cloudflare EMAIL binding when configured.
 * In local development (AUTH_DEV_MODE=true), returns the link without sending mail.
 */
export async function sendMagicLinkEmail(env, email, rawToken, request) {
  const magicLink = buildMagicLinkUrl(env, rawToken, request)

  if (isDevMode(env)) {
    console.info('[Piecelogue] AUTH_DEV_MODE enabled — skipping email delivery.')
    return {
      sent: false,
      devLink: magicLink,
    }
  }

  if (!env.EMAIL?.send) {
    throw new Error('Email delivery is not configured.')
  }

  const fromEmail = getFromAddress(env)
  if (!fromEmail) {
    throw new Error('AUTH_FROM_EMAIL is not configured.')
  }

  await env.EMAIL.send({
    type: 'text',
    from: { email: fromEmail, name: 'Piecelogue' },
    to: [{ email }],
    subject: 'Sign in to Piecelogue',
    text: [
      'Use this link to sign in to Piecelogue:',
      magicLink,
      '',
      'This link expires in 15 minutes and can only be used once.',
      'If you did not request this email, you can ignore it.',
    ].join('\n'),
  })

  return { sent: true }
}

export { buildMagicLinkUrl, getAppOrigin }
