import { deleteAllUserCloudData } from '../cloud/storage.js'
import { nowIso } from './tokens.js'

export async function revokeAllSessionsForUser(db, userId) {
  const revokedAt = nowIso()

  await db
    .prepare(
      `UPDATE auth_sessions
       SET revoked_at = ?
       WHERE user_id = ?
         AND revoked_at IS NULL`,
    )
    .bind(revokedAt, userId)
    .run()
}

export async function hardPurgeUserCloudRows(db, userId) {
  await db.prepare('DELETE FROM artworks WHERE user_id = ?').bind(userId).run()
  await db.prepare('DELETE FROM folders WHERE user_id = ?').bind(userId).run()
}

export async function deleteUserAccount(db, bucket, userId, email) {
  const cloudResult = await deleteAllUserCloudData(db, bucket, userId)
  await hardPurgeUserCloudRows(db, userId)
  await revokeAllSessionsForUser(db, userId)
  await db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').bind(userId).run()
  await db
    .prepare('DELETE FROM auth_magic_links WHERE LOWER(email) = LOWER(?)')
    .bind(email)
    .run()
  await db.prepare('DELETE FROM sync_events WHERE user_id = ?').bind(userId).run()
  await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run()

  return {
    ...cloudResult,
    accountDeleted: true,
  }
}
