import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ImageReadError } from './imageReadError.js'
import {
  bytesToBlob,
  readBytesFromBlobValue,
  readStoredImageBytes,
} from './readStoredImageBytes.js'
import { IMAGE_KINDS } from './artworkImageKeys.js'
import { classifySyncError, buildRetryUpdate } from '../sync/retry.js'

describe('readBytesFromBlobValue', () => {
  it('reads a healthy Blob into bytes', async () => {
    const blob = new Blob(['jpeg-data'], { type: 'image/jpeg' })
    const result = await readBytesFromBlobValue(blob, {
      artworkId: 'art-1',
      kind: IMAGE_KINDS.ORIGINAL,
    })

    assert.equal(result.byteLength, 9)
    assert.equal(result.mimeType, 'image/jpeg')
    assert.equal(new TextDecoder().decode(result.bytes), 'jpeg-data')
  })

  it('falls back when arrayBuffer throws Safari NotFoundError', async () => {
    const blob = new Blob(['broken'], { type: 'image/jpeg' })
    blob.arrayBuffer = async () => {
      throw new DOMException('The object can not be found here.', 'NotFoundError')
    }

    const result = await readBytesFromBlobValue(blob, {
      artworkId: 'art-mario',
      kind: IMAGE_KINDS.ORIGINAL,
    })

    assert.equal(result.byteLength, 6)
    assert.equal(result.diagnostic.domExceptionName, 'NotFoundError')
    assert.equal(result.diagnostic.fallbackSucceeded, true)
  })

  it('rejects zero-byte blobs', async () => {
    const blob = new Blob([], { type: 'image/jpeg' })

    await assert.rejects(
      () => readBytesFromBlobValue(blob),
      (error) => error instanceof ImageReadError && error.code === 'empty_image',
    )
  })
})

describe('readStoredImageBytes', () => {
  it('prefers durable bytes over legacy blobs', async () => {
    const legacyBlob = new Blob(['legacy'], { type: 'image/jpeg' })
    const durableBytes = new Uint8Array([1, 2, 3])

    const result = await readStoredImageBytes(
      'art-1',
      IMAGE_KINDS.ORIGINAL,
      { legacyBlob },
      {
        getDurableRecord: async () => ({
          data: durableBytes.buffer,
          byteLength: 3,
          mimeType: 'image/png',
          recoveryRequired: false,
        }),
      },
    )

    assert.equal(result.ok, true)
    assert.equal(result.source, 'durable')
    assert.deepEqual(Array.from(result.bytes), [1, 2, 3])
  })

  it('returns recovery_required for durable records marked unreadable', async () => {
    const result = await readStoredImageBytes(
      'art-1',
      IMAGE_KINDS.ORIGINAL,
      {},
      {
        getDurableRecord: async () => ({
          recoveryRequired: true,
          recoveryReason: 'unreadable_blob',
        }),
      },
    )

    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'recovery_required')
  })
})

describe('legacy migration behavior', () => {
  it('copies readable legacy blobs into durable storage', async () => {
    const legacyBlob = new Blob(['original'], { type: 'image/jpeg' })
    const readResult = await readStoredImageBytes(
      'art-1',
      IMAGE_KINDS.ORIGINAL,
      { legacyBlob },
      { getDurableRecord: async () => null },
    )

    assert.equal(readResult.ok, true)
    assert.equal(readResult.source, 'legacy')
    assert.equal(readResult.byteLength, 8)
  })

  it('marks unreadable legacy blobs as recovery required', async () => {
    const broken = new Blob(['broken'], { type: 'image/jpeg' })
    broken.arrayBuffer = async () => {
      throw new DOMException('The object can not be found here.', 'NotFoundError')
    }
    const originalResponse = globalThis.Response
    globalThis.Response = class {
      constructor() {}
      arrayBuffer() {
        throw new DOMException('The object can not be found here.', 'NotFoundError')
      }
    }

    try {
      const result = await readStoredImageBytes(
        'art-mario',
        IMAGE_KINDS.ORIGINAL,
        { legacyBlob: broken },
        {
          getDurableRecord: async () => null,
          runWithWatchdog: async (fn) => fn(),
        },
      )

      assert.equal(result.ok, false)
      assert.equal(result.error.code, 'unreadable_blob')
    } finally {
      globalThis.Response = originalResponse
    }
  })
})

describe('sync retry classification for image reads', () => {
  it('treats unreadable local images as permanent failures', () => {
    const error = new ImageReadError(
      'This image can no longer be read on this device.',
      'unreadable_blob',
      { permanent: true },
    )
    const classification = classifySyncError(error)
    assert.equal(classification.permanent, true)
    assert.equal(classification.retryable, false)

    const update = buildRetryUpdate({ attempts: 0 }, error)
    assert.equal(update.status, 'failed')
    assert.match(update.lastError, /can no longer be read/i)
  })
})

describe('bytes round trip', () => {
  it('creates a fresh Blob from verified bytes', () => {
    const blob = bytesToBlob(new Uint8Array([1, 2, 3]), 'image/jpeg')
    assert.equal(blob.type, 'image/jpeg')
    assert.equal(blob.size, 3)
  })
})
