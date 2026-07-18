export class ImageReadError extends Error {
  constructor(message, code, details = {}) {
    super(message)
    this.name = 'ImageReadError'
    this.code = code
    this.permanent = details.permanent !== false
    this.artworkId = details.artworkId ?? null
    this.kind = details.kind ?? null
    this.diagnostic = details.diagnostic ?? null
  }

  toUserMessage() {
    switch (this.code) {
      case 'recovery_required':
      case 'unreadable_blob':
        return 'This image can no longer be read on this device. Re-select the image to repair it.'
      case 'cloud_incomplete':
        return 'This image was never uploaded to cloud. Re-select the image to repair it, then sync again.'
      case 'missing_image':
        return 'Image file is missing on this device.'
      case 'empty_image':
        return 'Image file is empty.'
      case 'unsupported_format':
        return 'Unsupported image format. Use JPEG, PNG, WebP, or GIF.'
      default:
        return this.message || 'Could not read image file.'
    }
  }

  toDiagnosticString() {
    const title = this.artworkId || 'Artwork'
    const kind = this.kind ? `${this.kind} image` : 'image'
    return `${title} (${kind}): ${this.toUserMessage()}`
  }
}
