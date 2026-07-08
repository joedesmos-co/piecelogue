export const CLOUD_MAX_JSON_BYTES = 512 * 1024
export const CLOUD_MAX_IMAGE_BYTES = 25 * 1024 * 1024
export const CLOUD_MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024

export const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

export const IMAGE_EXTENSION_BY_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}
