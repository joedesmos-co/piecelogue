export const IMAGE_KINDS = {
  ORIGINAL: 'original',
  THUMBNAIL: 'thumbnail',
}

export function buildArtworkImageId(artworkId, kind) {
  return `${artworkId}:${kind}`
}

export function isImageKind(value) {
  return value === IMAGE_KINDS.ORIGINAL || value === IMAGE_KINDS.THUMBNAIL
}
