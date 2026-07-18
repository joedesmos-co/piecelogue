import assert from 'node:assert/strict'
import { afterEach, describe, it, mock } from 'node:test'
import { deleteAccount, deleteCloudData } from '../api/account.js'

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('account destructive API client', () => {
  afterEach(() => {
    mock.restoreAll()
  })

  it('uses POST with credentials for delete cloud data', async () => {
    let seen = null
    mock.method(globalThis, 'fetch', async (url, options = {}) => {
      seen = { url: String(url), method: options.method, credentials: options.credentials }
      return jsonResponse({ ok: true, deleted: true })
    })

    await deleteCloudData('DELETE CLOUD DATA')
    assert.equal(seen.method, 'POST')
    assert.equal(seen.credentials, 'include')
    assert.match(seen.url, /\/api\/account\/cloud-data$/)
  })

  it('uses POST with credentials for delete account', async () => {
    let seen = null
    mock.method(globalThis, 'fetch', async (url, options = {}) => {
      seen = { url: String(url), method: options.method, credentials: options.credentials }
      return jsonResponse({ ok: true, deleted: true })
    })

    await deleteAccount('DELETE MY ACCOUNT')
    assert.equal(seen.method, 'POST')
    assert.equal(seen.credentials, 'include')
    assert.match(seen.url, /\/api\/account$/)
  })
})
