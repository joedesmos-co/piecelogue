import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readImageBodyWithLimit } from './cloud.js'

describe('Worker image upload body reader', () => {
  it('reads an upload without requiring Content-Length', async () => {
    const request = new Request('https://example.test/api/cloud/artworks/art-1/original', {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/jpeg',
      },
      body: new Uint8Array([1, 2, 3, 4]),
    })

    assert.equal(request.headers.has('Content-Length'), false)
    const body = await readImageBodyWithLimit(request, 10)
    assert.deepEqual(Array.from(body), [1, 2, 3, 4])
  })

  it('stops reading when a streamed body exceeds the maximum', async () => {
    const request = new Request('https://example.test/api/cloud/artworks/art-1/original', {
      method: 'PUT',
      body: new Uint8Array([1, 2, 3, 4]),
    })

    await assert.rejects(
      () => readImageBodyWithLimit(request, 3),
      (error) => error?.name === 'BodyTooLargeError',
    )
  })
})
