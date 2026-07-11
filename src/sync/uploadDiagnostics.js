function randomSuffix() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function createUploadRequestId() {
  return `upl-${randomSuffix()}`
}

export function buildSafeUploadDiagnostic(details = {}) {
  return {
    requestId: details.requestId ?? null,
    artworkId: details.artworkId ?? null,
    stage: details.stage ?? null,
    mimeType: details.mimeType ?? null,
    format: details.format ?? 'unknown',
    blobSize: details.blobSize ?? null,
    byteSize: details.byteSize ?? null,
    exceedsLimit: Boolean(details.exceedsLimit),
  }
}

export function logUploadStart(details) {
  console.info('[Piecelogue] cloud.image_upload.client.start', buildSafeUploadDiagnostic(details))
}

export function logUploadEnd(details) {
  console.info('[Piecelogue] cloud.image_upload.client.end', buildSafeUploadDiagnostic(details))
}

export function logUploadFailure(details, error) {
  console.error('[Piecelogue] cloud.image_upload.client.failure', {
    ...buildSafeUploadDiagnostic(details),
    errorCode: error?.code ?? error?.name ?? 'unknown',
    httpStatus: error?.status ?? null,
    message: error?.message ?? 'Image upload failed.',
  })
}
