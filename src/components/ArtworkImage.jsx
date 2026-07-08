import { useMemo, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { coalesceBlob } from '../utils/imageUtils'
import { useObjectUrl } from '../hooks/useObjectUrl'

function blobsKey(blobs) {
  return blobs
    .map((blob) => `${blob.size}:${blob.type}:${blob.lastModified ?? ''}`)
    .join('|')
}

export default function ArtworkImage({
  blob,
  blobs,
  alt = '',
  className = '',
  loading,
  fallbackClassName = '',
  iconSize = 24,
}) {
  const candidates = useMemo(() => {
    const source = blobs?.length ? blobs : blob ? [blob] : []
    return source.map(coalesceBlob).filter(Boolean)
  }, [blob, blobs])

  const [candidateKey, setCandidateKey] = useState(() => blobsKey(candidates))
  const [activeIndex, setActiveIndex] = useState(0)
  const [exhausted, setExhausted] = useState(false)

  const currentKey = blobsKey(candidates)
  if (currentKey !== candidateKey) {
    setCandidateKey(currentKey)
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

  if (!candidates.length || exhausted) {
    return (
      <div
        className={`artwork-image-fallback ${fallbackClassName || className}`}
        role="img"
        aria-label={alt ? `${alt} unavailable` : 'Image unavailable'}
      >
        <ImageOff size={iconSize} strokeWidth={1.5} aria-hidden="true" />
        <span className="artwork-image-fallback-text">Image unavailable</span>
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
