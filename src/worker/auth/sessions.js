import { SESSION_TTL_MS } from './constants.js'
import { expiresAtIso, generateSecureToken, hashToken, nowIso } from './tokens.js'

export async function findUserByEmail(db, email) {
  return db
    .prepare('SELECT id, email, display_name, email_verified_at FROM users WHERE LOWER(email) = ?')
    .bind(email)
    .first()
}

export async function createVerifiedUser(db, email) {
  const id = crypto.randomUUID()
  const timestamp = nowIso()

  await db
    .prepare(
      `INSERT INTO users (id, email, display_name, created_at, updated_at, email_verified_at)
       VALUES (?, ?, NULL, ?, ?, ?)`,
    )
    .bind(id, email, timestamp, timestamp, timestamp)
    .run()

  return {
    id,
    email,
    display_name: null,
    email_verified_at: timestamp,
  }
}

export async function markUserEmailVerified(db, userId) {
  const timestamp = nowIso()

  await db
    .prepare(
      `UPDATE users
       SET email_verified_at = COALESCE(email_verified_at, ?),
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(timestamp, timestamp, userId)
    .run()
}

export async function findOrCreateVerifiedUser(db, email) {
  const existing = await findUserByEmail(db, email)

  if (existing) {
    await markUserEmailVerified(db, existing.id)
    return {
      id: existing.id,
      email: existing.email,
      display_name: existing.display_name ?? null,
    }
  }

  return createVerifiedUser(db, email)
}

export async function updateUserDisplayNameIfEmpty(db, userId, displayName) {
  const trimmed = displayName?.trim()
  if (!trimmed) {
    return
  }

  const timestamp = nowIso()

  await db
    .prepare(
      `UPDATE users
       SET display_name = ?, updated_at = ?
       WHERE id = ?
         AND (display_name IS NULL OR TRIM(display_name) = '')`,
    )
    .bind(trimmed, timestamp, userId)
    .run()
}

export async function createSession(db, userId) {
  const rawToken = generateSecureToken()
  const tokenHash = await hashToken(rawToken)
  const id = crypto.randomUUID()
  const createdAt = nowIso()
  const expiresAt = expiresAtIso(SESSION_TTL_MS)

  await db
    .prepare(
      `INSERT INTO auth_sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    )
    .bind(id, userId, tokenHash, createdAt, expiresAt, createdAt)
    .run()

  return { rawToken, expiresAt }
}

export async function getActiveSessionForToken(db, rawToken) {
  const tokenHash = await hashToken(rawToken)
  const now = nowIso()

  const row = await db
    .prepare(
      `SELECT
         s.id AS session_id,
         s.user_id,
         u.email,
         u.display_name
       FROM auth_sessions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?
         AND s.revoked_at IS NULL
         AND s.expires_at > ?`,
    )
    .bind(tokenHash, now)
    .first()

  if (!row) {
    return null
  }

  await db
    .prepare('UPDATE auth_sessions SET last_seen_at = ? WHERE id = ?')
    .bind(now, row.session_id)
    .run()

  return {
    id: row.user_id,
    email: row.email,
    displayName: row.display_name ?? null,
  }
}

export async function revokeSessionForToken(db, rawToken) {
  if (!rawToken) return

  const tokenHash = await hashToken(rawToken)
  const revokedAt = nowIso()

  await db
    .prepare(
      `UPDATE auth_sessions
       SET revoked_at = ?
       WHERE token_hash = ?
         AND revoked_at IS NULL`,
    )
    .bind(revokedAt, tokenHash)
    .run()
}
