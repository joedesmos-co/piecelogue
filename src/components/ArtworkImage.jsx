import { useMemo, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { coalesceBlob } from '../utils/imageUtils'
import { useObjectUrl } from '../hooks/useObjectUrl'
import { useArtworkImageSource } from '../hooks/useArtworkImageSource'

function blobsKey(blobs) {
  return blobs
    .map((blob) => `${blob.size}:${blob.type}:${blob.lastModified ?? ''}`)
    .join('|')
}

export default function ArtworkImage({
  artwork,
  mode = 'gallery',
  blob,
  blobs,
  alt = '',
  className = '',
  loading,
  fallbackClassName = '',
  iconSize = 24,
}) {
  const durableSource = useArtworkImageSource(artwork, mode)
  const candidates = useMemo(() => {
    if (artwork?.id) {
      return durableSource.blob ? [durableSource.blob] : []
    }

    const source = blobs?.length ? blobs : blob ? [blob] : []
    return source.map(coalesceBlob).filter(Boolean)
  }, [artwork, blob, blobs, durableSource.blob])

  const currentKey = blobsKey(candidates)
  const [trackedKey, setTrackedKey] = useState(currentKey)
  const [activeIndex, setActiveIndex] = useState(0)
  const [exhausted, setExhausted] = useState(false)

  if (currentKey !== trackedKey) {
    setTrackedKey(currentKey)
    setActiveIndex(0)
    setExhausted(false)
  }

  const activeBlob = candidates[activeIndex] ?? null
  const url = useObjectUrl(activeBlob)

  function handleError() {
    if (import.meta.env.DEV) {
      console.error('[Piecelogue] Failed to render artwork image:', alt || 'untitled')
    }

    if (activeIndex < candidates.length - 1) {
      setActiveIndex((index) => index + 1)
      return
    }

    setExhausted(true)
  }

  if (!candidates.length || exhausted || (artwork?.id && durableSource.unavailable)) {
    const cloudIncomplete =
      artwork &&
      typeof artwork.cloudHasOriginal === 'boolean' &&
      typeof artwork.cloudHasThumbnail === 'boolean' &&
      (!artwork.cloudHasOriginal || !artwork.cloudHasThumbnail)

    const fallbackText = cloudIncomplete
      ? 'Image not uploaded to cloud yet'
      : 'Image unavailable'
    const fallbackLabel = cloudIncomplete
      ? alt
        ? `${alt} image not uploaded to cloud yet`
        : 'Image not uploaded to cloud yet'
      : alt
        ? `${alt} unavailable`
        : 'Image unavailable'

    return (
      <div
        className={`artwork-image-fallback ${fallbackClassName || className}`}
        role="img"
        aria-label={fallbackLabel}
      >
        <ImageOff size={iconSize} strokeWidth={1.5} aria-hidden="true" />
        <span className="artwork-image-fallback-text">{fallbackText}</span>
      </div>
    )
  }

  if (!url) {
    return (
      <div
        className={`artwork-image-loading ${className}`}
        aria-hidden="true"
      />
    )
  }

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      loading={loading}
      decoding="async"
      onError={handleError}
    />
  )
}
