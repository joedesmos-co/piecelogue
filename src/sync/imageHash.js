export async function hashArrayBuffer(buffer) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', buffer)
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  }

  throw new Error('SHA-256 hashing is not available in this environment.')
}

export async function hashBlob(blob) {
  if (!blob) {
    return null
  }
  const buffer = await blob.arrayBuffer()
  return hashArrayBuffer(buffer)
}

export function shouldUploadImage(localHash, storedHash) {
  if (!localHash) {
    return false
  }
  if (!storedHash) {
    return true
  }
  return localHash !== storedHash
}

export function buildImageHashRecordId(userId, artworkId) {
  return `${userId}:${artworkId}`
}
