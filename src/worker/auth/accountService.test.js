import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { deleteUserAccount } from './accountService.js'

function createAccountDeletionDb() {
  const runs = []

  return {
    runs,
    prepare(sql) {
      return {
        bind(...args) {
          runs.push({ sql, args })

          if (sql.includes('SELECT') && sql.includes('FROM artworks')) {
            return {
              async all() {
                return { results: [] }
              },
            }
          }

          if (sql.includes('UPDATE folders')) {
            return {
              async run() {
                return { meta: { changes: 0 } }
              },
            }
          }

          return {
            async run() {
              return {}
            },
            async all() {
              return { results: [] }
            },
            async first() {
              return null
            },
          }
        },
      }
    },
  }
}

describe('deleteUserAccount', () => {
  it('purges cloud data, auth records, and the user row', async () => {
    const db = createAccountDeletionDb()

    const result = await deleteUserAccount(db, null, 'user-1', 'artist@example.com')

    assert.equal(result.accountDeleted, true)
    assert.equal(db.runs.some((entry) => entry.sql.includes('DELETE FROM artworks')), true)
    assert.equal(db.runs.some((entry) => entry.sql.includes('DELETE FROM folders')), true)
    assert.equal(db.runs.some((entry) => entry.sql.includes('UPDATE auth_sessions')), true)
    assert.equal(db.runs.some((entry) => entry.sql.includes('DELETE FROM auth_sessions')), true)
    assert.equal(db.runs.some((entry) => entry.sql.includes('DELETE FROM auth_magic_links')), true)
    assert.equal(db.runs.some((entry) => entry.sql.includes('DELETE FROM sync_events')), true)
    assert.equal(db.runs.some((entry) => entry.sql.includes('DELETE FROM users')), true)
  })
})
