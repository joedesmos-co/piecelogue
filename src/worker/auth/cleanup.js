import { nowIso } from './tokens.js'

export async function cleanupExpiredAuthRecords(db) {
  const now = nowIso()

  try {
    await db.batch([
      db.prepare('DELETE FROM auth_magic_links WHERE expires_at < ?').bind(now),
      db.prepare('DELETE FROM auth_sessions WHERE expires_at < ?').bind(now),
    ])
  } catch (error) {
    console.error('[Piecelogue] Auth cleanup failed:', error?.message || error)
  }
}
