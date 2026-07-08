import { nowIso } from './tokens.js'
import { normalizeUsername } from './username.js'

export async function getUserProfileById(db, userId) {
  return db
    .prepare(
      `SELECT id, email, display_name, username, username_updated_at
       FROM users
       WHERE id = ?`,
    )
    .bind(userId)
    .first()
}

export async function findUserByUsername(db, username) {
  const normalized = normalizeUsername(username)
  if (!normalized) return null

  return db
    .prepare('SELECT id, username FROM users WHERE LOWER(username) = ?')
    .bind(normalized)
    .first()
}

export async function updateUserUsername(db, userId, username) {
  const normalized = normalizeUsername(username)
  const timestamp = nowIso()

  await db
    .prepare(
      `UPDATE users
       SET username = ?,
           username_updated_at = ?,
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(normalized, timestamp, timestamp, userId)
    .run()

  return {
    username: normalized,
    usernameUpdatedAt: timestamp,
  }
}

export function publicProfile(user) {
  if (!user) return null

  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name ?? null,
    username: user.username ?? null,
    usernameUpdatedAt: user.username_updated_at ?? null,
  }
}
