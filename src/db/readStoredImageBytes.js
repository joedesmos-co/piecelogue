import { ImageReadError } from './imageReadError.js'

export const IMAGE_READ_WATCHDOG_MS = 15_000

function buildDiagnostic(blob, context = {}) {
  return {
    artworkId: context.artworkId ?? null,
    kind: context.kind ?? null,
    valueType: blob == null ? 'null' : typeof blob,
    isBlob: typeof Blob !== 'undefined' && blob instanceof Blob,
    mimeType: blob?.type ?? null,
    blobSize: typeof blob?.size === 'number' ? blob.size : null,
    readMethod: null,
    domExceptionName: null,
    domExceptionMessage: null,
    fallbackSucceeded: false,
  }
}

function readViaFileReader(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result)
        return
      }
      reject(new Error('FileReader did not return an ArrayBuffer.'))
    }
    reader.onerror = () => {
      reject(reader.error || new Error('FileReader failed.'))
    }
    reader.readAsArrayBuffer(blob)
  })
}

async function defaultWatchdog(fn, options = {}) {
  const timeoutMs = options.timeoutMs ?? IMAGE_READ_WATCHDOG_MS
  let timeoutId = null

  try {
    return await Promise.race([
      Promise.resolve().then(fn),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new ImageReadError('Image read timed out.', 'read_timeout', { permanent: true }))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

export async function readBytesFromBlobValue(blob, context = {}, deps = {}) {
  const runWithWatchdog = deps.runWithWatchdog ?? defaultWatchdog
  const diagnostic = buildDiagnostic(blob, context)

  if (!blob || typeof blob !== 'object') {
    throw new ImageReadError('Image file is missing.', 'missing_image', {
      ...context,
      diagnostic,
      permanent: true,
    })
  }

  const methods = [
    { name: 'arrayBuffer', fn: () => blob.arrayBuffer() },
    { name: 'response', fn: async () => (await new Response(blob).arrayBuffer()) },
    { name: 'fileReader', fn: () => readViaFileReader(blob) },
  ]

  let lastError = null

  for (const method of methods) {
    diagnostic.readMethod = method.name
    try {
      const buffer = await runWithWatchdog(method.fn, { timeoutMs: IMAGE_READ_WATCHDOG_MS })
      const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
      if (bytes.byteLength === 0) {
        throw new ImageReadError('Image file is empty.', 'empty_image', {
          ...context,
          diagnostic,
          permanent: true,
        })
      }

      diagnostic.fallbackSucceeded = method.name !== 'arrayBuffer'
      return {
        bytes,
        mimeType: (blob.type || 'application/octet-stream').split(';')[0].trim().toLowerCase(),
        byteLength: bytes.byteLength,
        diagnostic,
      }
    } catch (error) {
      if (error instanceof ImageReadError) {
        throw error
      }

      lastError = error
      diagnostic.domExceptionName = error?.name ?? null
      diagnostic.domExceptionMessage = error?.message ?? null
    }
  }

  throw new ImageReadError(
    'This image can no longer be read on this device.',
    'unreadable_blob',
    {
      ...context,
      diagnostic: {
        ...diagnostic,
        lastErrorName: lastError?.name ?? null,
      },
      permanent: true,
    },
  )
}

export async function readStoredImageBytes(artworkId, kind, options = {}, deps = {}) {
  const getDurableRecord = deps.getDurableRecord ?? (async () => null)
  const durableRecord = await getDurableRecord(artworkId, kind)

  if (durableRecord?.recoveryRequired) {
    return {
      ok: false,
      error: new ImageReadError(
        'This image can no longer be read on this device.',
        'recovery_required',
        {
          artworkId,
          kind,
          diagnostic: { source: 'durable', recoveryRequired: true },
          permanent: true,
        },
      ),
    }
  }

  if (durableRecord?.data && durableRecord.byteLength > 0) {
    const bytes =
      durableRecord.data instanceof Uint8Array
        ? durableRecord.data
        : new Uint8Array(durableRecord.data)
    if (bytes.byteLength === durableRecord.byteLength) {
      return {
        ok: true,
        bytes,
        mimeType: durableRecord.mimeType || 'application/octet-stream',
        byteLength: bytes.byteLength,
        source: 'durable',
        diagnostic: {
          artworkId,
          kind,
          source: 'durable',
          byteLength: bytes.byteLength,
          mimeType: durableRecord.mimeType ?? null,
        },
      }
    }
  }

  const legacyBlob = options.legacyBlob ?? null
  if (!legacyBlob) {
    return {
      ok: false,
      error: new ImageReadError('Image file is missing.', 'missing_image', {
        artworkId,
        kind,
        diagnostic: buildDiagnostic(null, { artworkId, kind }),
        permanent: true,
      }),
    }
  }

  try {
    const read = await readBytesFromBlobValue(legacyBlob, { artworkId, kind }, deps)
    return {
      ok: true,
      ...read,
      source: 'legacy',
    }
  } catch (error) {
    const readError =
      error instanceof ImageReadError
        ? error
        : new ImageReadError('Could not read image file.', 'unreadable_blob', {
            artworkId,
            kind,
            diagnostic: buildDiagnostic(legacyBlob, { artworkId, kind }),
            permanent: true,
          })

    return {
      ok: false,
      error: readError,
      diagnostic: readError.diagnostic,
    }
  }
}

export function bytesToBlob(bytes, mimeType = 'application/octet-stream') {
  const buffer =
    bytes instanceof ArrayBuffer
      ? bytes
      : bytes instanceof Uint8Array
        ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
        : bytes
  return new Blob([buffer], { type: mimeType || 'application/octet-stream' })
}

export function logImageReadDiagnostic(scope, diagnostic) {
  if (!diagnostic) {
    return
  }

  const payload = {
    artworkId: diagnostic.artworkId ?? null,
    kind: diagnostic.kind ?? null,
    source: diagnostic.source ?? null,
    valueType: diagnostic.valueType ?? null,
    isBlob: diagnostic.isBlob ?? null,
    mimeType: diagnostic.mimeType ?? null,
    blobSize: diagnostic.blobSize ?? null,
    byteLength: diagnostic.byteLength ?? null,
    readMethod: diagnostic.readMethod ?? null,
    domExceptionName: diagnostic.domExceptionName ?? null,
    domExceptionMessage: diagnostic.domExceptionMessage ?? null,
    fallbackSucceeded: diagnostic.fallbackSucceeded ?? null,
  }

  if (import.meta.env?.DEV) {
    console.info(`[Piecelogue] ${scope}`, payload)
  } else if (diagnostic.domExceptionName || diagnostic.recoveryRequired) {
    console.error(`[Piecelogue] ${scope}`, payload)
  }
}
