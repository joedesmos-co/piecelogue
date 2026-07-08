import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { coalesceBlob } from '../utils/imageUtils'
import {
  acquireBlobUrl,
  getBlobUrlSnapshot,
  releaseBlobUrl,
  subscribeBlobUrls,
} from '../utils/blobUrlManager'

/**
 * Returns a ref-counted object URL for a Blob. URLs are shared across components
 * using the same Blob instance and revoked only when no consumers remain.
 */
export function useObjectUrl(blob) {
  const resolved = useMemo(() => coalesceBlob(blob), [blob])

  const objectUrl = useSyncExternalStore(
    subscribeBlobUrls,
    () => getBlobUrlSnapshot(resolved),
    () => null,
  )

  useEffect(() => {
    if (!resolved) return undefined

    acquireBlobUrl(resolved)

    return () => {
      releaseBlobUrl(resolved)
    }
  }, [resolved])

  return objectUrl
}
