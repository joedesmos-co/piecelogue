import { getDurableImageRecord } from './artworkImageStorage.js'
import {
  bytesToBlob,
  logImageReadDiagnostic,
  readBytesFromBlobValue,
  readStoredImageBytes,
} from './readStoredImageBytes.js'

export async function readArtworkImageBytes(artworkId, kind, options = {}) {
  return readStoredImageBytes(artworkId, kind, options, {
    getDurableRecord: getDurableImageRecord,
    ...options.deps,
  })
}

export { bytesToBlob, logImageReadDiagnostic, readBytesFromBlobValue, readStoredImageBytes }
