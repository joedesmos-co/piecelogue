import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isDevMode, sendMagicLinkEmail } from '../email/sendMagicLinkEmail.js'

describe('sendMagicLinkEmail dev mode', () => {
  it('detects local development mode flag', () => {
    assert.equal(isDevMode({ AUTH_DEV_MODE: 'true' }), true)
    assert.equal(isDevMode({ AUTH_DEV_MODE: ' TRUE ' }), true)
    assert.equal(isDevMode({ AUTH_DEV_MODE: '1' }), true)
    assert.equal(isDevMode({ ENVIRONMENT: 'development' }), true)
    assert.equal(isDevMode({ AUTH_DEV_MODE: 'false' }), false)
    assert.equal(isDevMode({}), false)
  })
})

describe('sendMagicLinkEmail production', () => {
  it('skips email and returns devLink only in dev mode', async () => {
    const result = await sendMagicLinkEmail(
      { AUTH_DEV_MODE: 'true', APP_ORIGIN: 'http://localhost:8787' },
      'artist@example.com',
      'dev-token',
      new Request('http://localhost:8787/api/auth/request-link'),
    )

    assert.equal(result.sent, false)
    assert.match(result.devLink, /token=dev-token/)
  })

  it('sends email in production when EMAIL binding is configured', async () => {
    const sentMessages = []
    const env = {
      ENVIRONMENT: 'production',
      APP_ORIGIN: 'https://piecelogue.com',
      AUTH_FROM_EMAIL: 'noreply@piecelogue.com',
      EMAIL: {
        send: async (message) => {
          sentMessages.push(message)
          return { messageId: 'msg-123' }
        },
      },
    }

    const result = await sendMagicLinkEmail(env, 'artist@example.com', 'prod-token', null)

    assert.equal(result.sent, true)
    assert.equal(result.devLink, undefined)
    assert.equal(sentMessages.length, 1)
    assert.equal(sentMessages[0].from.email, 'noreply@piecelogue.com')
    assert.equal(sentMessages[0].from.name, 'Piecelogue')
    assert.equal(sentMessages[0].to.email, 'artist@example.com')
    assert.equal(sentMessages[0].subject, 'Sign in to Piecelogue')
    assert.match(sentMessages[0].text, /https:\/\/piecelogue\.com\/api\/auth\/verify\?token=prod-token/)
    assert.equal(sentMessages[0].type, undefined)
  })

  it('throws when EMAIL binding is missing outside dev mode', async () => {
    await assert.rejects(
      () =>
        sendMagicLinkEmail(
          { ENVIRONMENT: 'production', AUTH_FROM_EMAIL: 'noreply@piecelogue.com' },
          'artist@example.com',
          'prod-token',
          null,
        ),
      /Email delivery is not configured/,
    )
  })

  it('throws when AUTH_FROM_EMAIL is missing outside dev mode', async () => {
    await assert.rejects(
      () =>
        sendMagicLinkEmail(
          {
            ENVIRONMENT: 'production',
            EMAIL: { send: async () => ({ messageId: 'msg-123' }) },
          },
          'artist@example.com',
          'prod-token',
          null,
        ),
      /AUTH_FROM_EMAIL is not configured/,
    )
  })
})
