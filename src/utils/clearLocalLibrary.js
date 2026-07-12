import { db } from '../db/database.js'

const LIBRARY_TABLES = [
  db.artworks,
  db.folders,
  db.artworkImages,
  db.syncQueue,
  db.syncImageHashes,
  db.syncState,
  db.syncConflicts,
]

/**
 * Removes all local library data from IndexedDB on this device.
 * Does not call cloud APIs — cloud backup is unchanged.
 */
export async function clearLocalLibrary() {
  await db.transaction('rw', LIBRARY_TABLES, async () => {
    await Promise.all(LIBRARY_TABLES.map((table) => table.clear()))
  })
}

export const SIGNED_OUT_LIBRARY_FLAG = 'piecelogue_signed_out_library'

export function markSignedOutLibraryCleared() {
  try {
    sessionStorage.setItem(SIGNED_OUT_LIBRARY_FLAG, '1')
  } catch {
    // Ignore storage failures.
  }
}

export function clearSignedOutLibraryFlag() {
  try {
    sessionStorage.removeItem(SIGNED_OUT_LIBRARY_FLAG)
  } catch {
    // Ignore storage failures.
  }
}

export function wasLibraryClearedOnSignOut() {
  try {
    return sessionStorage.getItem(SIGNED_OUT_LIBRARY_FLAG) === '1'
  } catch {
    return false
  }
}
