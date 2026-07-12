import { useEffect, useState } from 'react'
import { readArtworkImageBytes, bytesToBlob } from '../db/artworkImageReader.js'
import { IMAGE_KINDS } from '../db/artworkImageKeys.js'
import { ensureArtworkImagesMigrated } from '../db/legacyImageMigration.js'

export function useArtworkImageSource(artwork, mode = 'gallery') {
  const artworkId = artwork?.id ?? null
  const [blob, setBlob] = useState(null)
  const [unavailable, setUnavailable] = useState(false)
  const [loading, setLoading] = useState(Boolean(artworkId))

  useEffect(() => {
    if (!artworkId) {
      return undefined
    }

    let cancelled = false
    const kinds =
      mode === 'gallery'
        ? [IMAGE_KINDS.THUMBNAIL, IMAGE_KINDS.ORIGINAL]
        : [IMAGE_KINDS.ORIGINAL, IMAGE_KINDS.THUMBNAIL]

    async function load() {
      setLoading(true)
      setUnavailable(false)
      setBlob(null)

      try {
        await ensureArtworkImagesMigrated(artworkId)
        for (const kind of kinds) {
          const legacyBlob =
            kind === IMAGE_KINDS.THUMBNAIL ? artwork.thumbnail : artwork.image
          const result = await readArtworkImageBytes(artworkId, kind, { legacyBlob })
          if (cancelled) {
            return
          }
          if (result.ok) {
            setBlob(bytesToBlob(result.bytes, result.mimeType))
            setUnavailable(false)
            setLoading(false)
            return
          }
        }
        if (!cancelled) {
          setUnavailable(true)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setUnavailable(true)
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [artworkId, artwork?.updatedAt, artwork?.image, artwork?.thumbnail, mode])

  if (!artworkId) {
    return { blob: null, unavailable: false, loading: false }
  }

  return { blob, unavailable, loading }
}
