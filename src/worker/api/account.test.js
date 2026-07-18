import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { handleAccountRoute } from './account.js'

function createUnauthenticatedEnv() {
  return {
    ENVIRONMENT: 'development',
    DB: {
      prepare() {
        return {
          bind() {
            return {
              async first() {
                return null
              },
              async run() {
                return {}
              },
            }
          },
        }
      },
    },
  }
}

describe('account routes authorization', () => {
  it('requires sign-in for DELETE /api/account', async () => {
    const request = new Request('http://localhost/api/account', {
      method: 'DELETE',
      body: JSON.stringify({ confirmation: 'DELETE MY ACCOUNT' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await handleAccountRoute(request, createUnauthenticatedEnv(), '/api/account')
    const data = await response.json()

    assert.equal(response.status, 401)
    assert.equal(data.error.code, 'unauthorized')
  })

  it('requires sign-in for DELETE /api/account/cloud-data', async () => {
    const request = new Request('http://localhost/api/account/cloud-data', {
      method: 'DELETE',
      body: JSON.stringify({ confirmation: 'DELETE CLOUD DATA' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await handleAccountRoute(
      request,
      createUnauthenticatedEnv(),
      '/api/account/cloud-data',
    )
    const data = await response.json()

    assert.equal(response.status, 401)
    assert.equal(data.error.code, 'unauthorized')
  })

  it('rejects unsupported methods', async () => {
    const request = new Request('http://localhost/api/account', { method: 'GET' })
    const response = await handleAccountRoute(request, createUnauthenticatedEnv(), '/api/account')

    assert.equal(response.status, 405)
  })

  it('requires sign-in for POST /api/account/cloud-data', async () => {
    const request = new Request('http://localhost/api/account/cloud-data', {
      method: 'POST',
      body: JSON.stringify({ confirmation: 'DELETE CLOUD DATA' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await handleAccountRoute(
      request,
      createUnauthenticatedEnv(),
      '/api/account/cloud-data',
    )
    const data = await response.json()

    assert.equal(response.status, 401)
    assert.equal(data.error.code, 'unauthorized')
  })

  it('accepts POST method for cloud-data (Safari-safe body)', async () => {
    const request = new Request('http://localhost/api/account/cloud-data', {
      method: 'POST',
      body: JSON.stringify({ confirmation: 'wrong' }),
      headers: { 'Content-Type': 'application/json' },
    })

    // Still unauthorized first; method itself is allowed (not 405).
    const response = await handleAccountRoute(
      request,
      createUnauthenticatedEnv(),
      '/api/account/cloud-data',
    )
    assert.notEqual(response.status, 405)
  })
})
