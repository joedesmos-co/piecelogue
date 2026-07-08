import {
  MAGIC_LINK_TTL_MS,
  REQUEST_LINK_COOLDOWN_MS,
} from './constants.js'
import { expiresAtIso, generateSecureToken, hashToken, nowIso } from './tokens.js'

export async function getRecentMagicLinkRequest(db, email) {
  return db
    .prepare(
      `SELECT created_at
       FROM auth_magic_links
       WHERE email = ?
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .bind(email)
    .first()
}

export function isWithinRequestCooldown(createdAtIso) {
  if (!createdAtIso) return false
  const elapsed = Date.now() - Date.parse(createdAtIso)
  return elapsed < REQUEST_LINK_COOLDOWN_MS
}

export async function createMagicLink(db, email) {
  const rawToken = generateSecureToken()
  const tokenHash = await hashToken(rawToken)
  const id = crypto.randomUUID()
  const createdAt = nowIso()
  const expiresAt = expiresAtIso(MAGIC_LINK_TTL_MS)
  const supersededAt = createdAt

  await db.batch([
    db
      .prepare(
        `UPDATE auth_magic_links
         SET consumed_at = ?
         WHERE email = ?
           AND consumed_at IS NULL
           AND expires_at > ?`,
      )
      .bind(supersededAt, email, createdAt),
    db
      .prepare(
        `INSERT INTO auth_magic_links (id, email, token_hash, created_at, expires_at, consumed_at)
         VALUES (?, ?, ?, ?, ?, NULL)`,
      )
      .bind(id, email, tokenHash, createdAt, expiresAt),
  ])

  return { rawToken, expiresAt }
}

export async function consumeMagicLink(db, rawToken) {
  const tokenHash = await hashToken(rawToken)
  const consumedAt = nowIso()

  const row = await db
    .prepare(
      `UPDATE auth_magic_links
       SET consumed_at = ?
       WHERE token_hash = ?
         AND consumed_at IS NULL
         AND expires_at > ?
       RETURNING id, email`,
    )
    .bind(consumedAt, tokenHash, consumedAt)
    .first()

  if (!row) {
    return null
  }

  return { email: row.email }
}
