/**
 * Folder preview selection.
 *
 * Folder cards render a contact sheet of their most recent artworks. The
 * artwork rows themselves no longer carry image bytes -- those live in the
 * durable `artworkImages` store -- so a folder can only pass artwork metadata
 * and let the shared image reader resolve the bytes, exactly like ArtworkCard.
 */

/** Folder cards render one leading cell plus up to two more previews. */
export const FOLDER_PREVIEW_LIMIT = 3

/**
 * Pick the artworks to preview, newest first.
 *
 * @param {Array<object>} folderArtworks artwork rows that live in this folder
 * @param {number} [limit] how many previews to build
 */
export function selectFolderPreviewArtworks(folderArtworks = [], limit = FOLDER_PREVIEW_LIMIT) {
  const sorted = [...folderArtworks].sort(
    (a, b) => new Date(b.updatedAt ?? 0) - new Date(a.updatedAt ?? 0),
  )
  return sorted.slice(0, limit)
}

/**
 * Reduce artwork rows to the minimal descriptor the image reader needs.
 *
 * Only identity and freshness are required: the durable reader looks up bytes
 * by `id`, and `updatedAt` is what makes a view re-read after an edit.
 */
export function toFolderPreviewRecord(artwork) {
  if (!artwork?.id) {
    return null
  }

  return {
    id: artwork.id,
    title: artwork.title,
    folderId: artwork.folderId ?? null,
    updatedAt: artwork.updatedAt ?? null,
  }
}

/**
 * Build the preview list for one folder.
 *
 * Every artwork that belongs in the folder yields a preview entry, so a folder
 * holding artworks with damaged or missing images still shows the expected
 * number of preview cells (with a per-cell fallback) rather than collapsing to
 * fewer cells.
 */
export function buildFolderPreviews(folderArtworks = [], limit = FOLDER_PREVIEW_LIMIT) {
  return selectFolderPreviewArtworks(folderArtworks, limit)
    .map(toFolderPreviewRecord)
    .filter(Boolean)
}
