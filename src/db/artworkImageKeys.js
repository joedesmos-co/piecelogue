export const IMAGE_KINDS = {
  ORIGINAL: 'original',
  THUMBNAIL: 'thumbnail',
  SOURCE: 'source', // Untouched imported file; never uploaded.
  DISPLAY: 'display', // Cached cloud bytes; never an encoder input.
}

export function buildArtworkImageId(artworkId, kind) {
  return `${artworkId}:${kind}`
}

export function isImageKind(value) {
  return Object.values(IMAGE_KINDS).includes(value)
}

/** The original slot holds a local viewing image OR exact restored display bytes. */
export function getArtworkImageKinds(mode = 'gallery') {
  return mode === 'gallery'
    ? [IMAGE_KINDS.THUMBNAIL, IMAGE_KINDS.ORIGINAL]
    : [IMAGE_KINDS.ORIGINAL, IMAGE_KINDS.THUMBNAIL]
}
