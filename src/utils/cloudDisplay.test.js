import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createCloudDisplayImage, CLOUD_DISPLAY_QUALITY, CLOUD_DISPLAY_MAX_BYTES,
} from './imageNormalize.js'

function encoder({ width = 4032, height = 3024, fallback = false, oversized = false } = {}) {
  const draws = [], exports = []
  let closed = 0
  const source = { width, height, close() { closed++ } }
  return {
    draws, exports, get closed() { return closed },
    deps: {
      createImageBitmap: async () => source,
      createCanvas: (width, height) => ({ width, height, getContext: () => ({
        fillRect() {}, drawImage(...args) { draws.push(args) },
      }) }),
      canvasToBlob: async (canvas, type, quality) => {
        exports.push({ width: canvas.width, height: canvas.height, type, quality })
        const size = oversized ? CLOUD_DISPLAY_MAX_BYTES + 1 : 300_000
        return new Blob([new Uint8Array(size)], { type: fallback && type === 'image/webp' ? 'image/png' : type })
      },
    },
  }
}
const input = new Blob([new Uint8Array([255, 216, 255, 1])], { type: 'image/jpeg' })

test('cloud quality: 2048 edge, aspect ratio, high quality and one encode from source', async () => {
  const mock = encoder()
  const result = await createCloudDisplayImage(input, mock.deps)
  assert.deepEqual(mock.exports, [{ width: 2048, height: 1536, type: 'image/webp', quality: 0.9 }])
  assert.equal(CLOUD_DISPLAY_QUALITY, 0.9)
  assert.equal(result.blob.type, 'image/webp')
  assert.equal(mock.closed, 1)
})
test('small images never upscale', async () => {
  const result = await createCloudDisplayImage(input, encoder({ width: 320, height: 200 }).deps)
  assert.equal(result.width, 320)
  assert.equal(result.height, 200)
})
test('unsupported WebP export retries JPEG; silent PNG is never uploaded', async () => {
  const mock = encoder({ fallback: true })
  const result = await createCloudDisplayImage(input, mock.deps)
  assert.equal(result.blob.type, 'image/jpeg')
  assert.deepEqual(mock.exports.map(x => x.type), ['image/webp', 'image/jpeg'])
  assert.ok(mock.exports.every(x => x.quality === 0.9))
})
test('byte guard retries at 1600 from the decoded source, never from compressed output', async () => {
  const mock = encoder({ oversized: true })
  await assert.rejects(createCloudDisplayImage(input, mock.deps), /compact cloud image/)
  assert.deepEqual(mock.exports.map(x => x.width), [2048, 1600])
  assert.equal(mock.draws[0][0], mock.draws[1][0])
  assert.equal(mock.closed, 1)
})
test('empty and corrupt images fail without an original-upload fallback', async () => {
  await assert.rejects(createCloudDisplayImage(new Blob([])), /empty/)
  await assert.rejects(createCloudDisplayImage(input, { createImageBitmap: async () => { throw Error() } }), /prepare cloud image/)
})

test('WebP encoder exceptions use JPEG fallback', async () => {
  const mock = encoder()
  const encode = mock.deps.canvasToBlob
  mock.deps.canvasToBlob = (canvas, type, quality) => {
    if (type === 'image/webp') throw new Error('unsupported encoder')
    return encode(canvas, type, quality)
  }
  const result = await createCloudDisplayImage(input, mock.deps)
  assert.equal(result.blob.type, 'image/jpeg')
})
