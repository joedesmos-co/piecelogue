import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildUserRateLimitKey, checkRateLimit } from './rateLimit.js'

function createRateLimitDb() {
  const buckets = new Map()

  return {
    buckets,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes('SELECT')) {
                const key = args[0]
                return buckets.get(key) ?? null
              }
              return null
            },
            async run() {
              if (sql.includes('INSERT INTO rate_limit_buckets')) {
                buckets.set(args[0], { window_start: args[1], hit_count: args[2] })
              }
              if (sql.includes('UPDATE rate_limit_buckets')) {
                const key = args[0]
                const entry = buckets.get(key)
                if (entry) {
                  entry.hit_count += 1
                }
              }
            },
          }
        },
      }
    },
  }
}

describe('rate limiting', () => {
  it('allows requests under the configured limit', async () => {
    const db = createRateLimitDb()
    const config = { maxHits: 2, windowMs: 60_000 }
    const key = buildUserRateLimitKey('cloud:image', 'user-1')
    const now = Date.parse('2026-07-08T12:00:10.000Z')

    const first = await checkRateLimit(db, key, config, now)
    const second = await checkRateLimit(db, key, config, now + 1000)

    assert.equal(first.allowed, true)
    assert.equal(second.allowed, true)
  })

  it('blocks requests once the window is exhausted', async () => {
    const db = createRateLimitDb()
    const config = { maxHits: 2, windowMs: 60_000 }
    const key = buildUserRateLimitKey('account:delete', 'user-1')
    const now = Date.parse('2026-07-08T12:00:10.000Z')

    await checkRateLimit(db, key, config, now)
    await checkRateLimit(db, key, config, now + 500)
    const blocked = await checkRateLimit(db, key, config, now + 1000)

    assert.equal(blocked.allowed, false)
    assert.equal(blocked.remaining, 0)
  })
})
