export const RATE_LIMITS = {
  CLOUD_IMAGE_UPLOAD: { maxHits: 120, windowMs: 60 * 60 * 1000 },
  ACCOUNT_DESTRUCTIVE: { maxHits: 5, windowMs: 60 * 60 * 1000 },
}

function getWindowStart(nowMs, windowMs) {
  const windowStartMs = Math.floor(nowMs / windowMs) * windowMs
  return new Date(windowStartMs).toISOString()
}

export async function checkRateLimit(db, bucketKey, { maxHits, windowMs }, nowMs = Date.now()) {
  if (!db || !bucketKey) {
    return { allowed: true, remaining: maxHits }
  }

  const windowStart = getWindowStart(nowMs, windowMs)
  const existing = await db
    .prepare('SELECT window_start, hit_count FROM rate_limit_buckets WHERE bucket_key = ?')
    .bind(bucketKey)
    .first()

  if (!existing || existing.window_start !== windowStart) {
    await db
      .prepare(
        `INSERT INTO rate_limit_buckets (bucket_key, window_start, hit_count)
         VALUES (?, ?, 1)
         ON CONFLICT(bucket_key) DO UPDATE SET
           window_start = excluded.window_start,
           hit_count = excluded.hit_count`,
      )
      .bind(bucketKey, windowStart, 1)
      .run()

    return { allowed: true, remaining: Math.max(0, maxHits - 1) }
  }

  if (existing.hit_count >= maxHits) {
    return { allowed: false, remaining: 0, retryAfterMs: windowMs - (nowMs % windowMs) }
  }

  await db
    .prepare(
      `UPDATE rate_limit_buckets
       SET hit_count = hit_count + 1
       WHERE bucket_key = ? AND window_start = ?`,
    )
    .bind(bucketKey, windowStart)
    .run()

  return { allowed: true, remaining: Math.max(0, maxHits - existing.hit_count - 1) }
}

export async function cleanupExpiredRateLimitBuckets(db, nowMs = Date.now()) {
  if (!db) {
    return
  }

  const cutoff = new Date(nowMs - 48 * 60 * 60 * 1000).toISOString()
  await db
    .prepare('DELETE FROM rate_limit_buckets WHERE window_start < ?')
    .bind(cutoff)
    .run()
}

export function buildUserRateLimitKey(scope, userId) {
  return `${scope}:${userId}`
}
