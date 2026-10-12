import { useCallback, useEffect, useState } from 'react'
import { readArtworkImageBytes, bytesToBlob } from '../db/artworkImageReader.js'
import { IMAGE_KINDS, getArtworkImageKinds } from '../db/artworkImageKeys.js'
import { ensureArtworkImagesMigrated } from '../db/legacyImageMigration.js'
import { onArtworkImagesChanged } from '../db/imageChangeEvents.js'

/**
 * Resolve an artwork's image from the durable artworkImages store.
 *
 * The durable store is the primary source. `artwork.image` / `artwork.thumbnail`
 * are only consulted as a one-time migration fallback for legacy records that
 * never had durable bytes.
 */
export function useArtworkImageSource(artwork, mode = 'gallery') {
  const artworkId = artwork?.id ?? null
  const [blob, setBlob] = useState(null)
  const [unavailable, setUnavailable] = useState(false)
  const [loading, setLoading] = useState(Boolean(artworkId))
  const [durableVersion, setDurableVersion] = useState(0)

  // Background restore, sync, repair and migration write durable bytes without
  // changing the artwork row, so watch the image store too.
  const handleImageChange = useCallback(
    (detail) => {
      if (!artworkId) return
      if (!detail?.all && detail?.artworkId && detail.artworkId !== artworkId) return
      setDurableVersion((version) => version + 1)
    },
    [artworkId],
  )

  useEffect(() => onArtworkImagesChanged(handleImageChange), [handleImageChange])

  useEffect(() => {
    if (!artworkId) {
      return undefined
    }

    let cancelled = false
    const kinds = getArtworkImageKinds(mode)

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
  }, [artworkId, durableVersion, artwork?.updatedAt, mode, artwork])

  if (!artworkId) {
    return { blob: null, unavailable: false, loading: false }
  }

  return { blob, unavailable, loading, durableVersion }
}
