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

/**
 * Strict D1 stand-in: like real D1 it rejects a statement whose bind count
 * does not match its `?` placeholder count. The looser fake above could not
 * catch the `VALUES (?, ?, 1)` / `.bind(a, b, 1)` mismatch that made every
 * image upload fail with D1_ERROR before reaching R2.
 */
function createStrictRateLimitDb() {
  const buckets = new Map()

  return {
    buckets,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              return sql.includes('SELECT') ? (buckets.get(args[0]) ?? null) : null
            },
            async run() {
              const placeholders = (sql.match(/\?/g) ?? []).length
              if (placeholders !== args.length) {
                throw new Error(
                  `Wrong number of parameter bindings: ${args.length} for ${placeholders}`,
                )
              }
              if (sql.includes('INSERT INTO rate_limit_buckets')) {
                buckets.set(args[0], { window_start: args[1], hit_count: args[2] })
              }
              if (sql.includes('UPDATE rate_limit_buckets')) {
                const entry = buckets.get(args[0])
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

  it('issues SQL D1 accepts (placeholder count matches bindings)', async () => {
    const db = createStrictRateLimitDb()
    const config = { maxHits: 5, windowMs: 60_000 }
    const key = buildUserRateLimitKey('cloud:image', 'user-1')
    const now = Date.parse('2026-07-08T12:00:10.000Z')

    // First call INSERTs a new bucket, second takes the UPDATE path.
    await assert.doesNotReject(() => checkRateLimit(db, key, config, now))
    await assert.doesNotReject(() => checkRateLimit(db, key, config, now + 1000))
    assert.equal(db.buckets.get(key).hit_count, 2)
  })
})
