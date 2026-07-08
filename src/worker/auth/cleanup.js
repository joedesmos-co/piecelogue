import { nowIso } from './tokens.js'
import { cleanupExpiredRateLimitBuckets } from '../rateLimit.js'
import { logError } from '../log.js'

export async function cleanupExpiredAuthRecords(db) {
  const now = nowIso()

  try {
    await db.batch([
      db.prepare('DELETE FROM auth_magic_links WHERE expires_at < ?').bind(now),
      db.prepare('DELETE FROM auth_sessions WHERE expires_at < ?').bind(now),
    ])
    await cleanupExpiredRateLimitBuckets(db)
  } catch (error) {
    logError('auth.cleanup', error)
  }
}
