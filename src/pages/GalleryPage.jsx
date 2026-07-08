import { useMemo, useState } from 'react'
import { ArrowLeft, FolderPlus, ImageIcon } from 'lucide-react'
import { useArtworks } from '../hooks/useArtworks'
import { GALLERY_VIEWS } from '../utils/constants'
import ArtworkCard from '../components/ArtworkCard'
import ArtworkDetail from '../components/ArtworkDetail'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import FolderCard from '../components/FolderCard'
import FolderNameDialog from '../components/FolderNameDialog'
import GalleryContextMenu from '../components/GalleryContextMenu'

export default function GalleryPage({ onAdd, onEdit }) {
  const {
    artworks,
    folders,
    loading,
    error,
    removeArtwork,
    toggleFavorite,
    createFolder,
    renameFolder,
    removeFolder,
  } = useArtworks()

  const [view, setView] = useState(GALLERY_VIEWS.HOME)
  const [selectedFolderId, setSelectedFolderId] = useState(null)
  const [selectedArtwork, setSelectedArtwork] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [folderDialog, setFolderDialog] = useState(null)
  const [folderSaving, setFolderSaving] = useState(false)
  const [deleteFolderTarget, setDeleteFolderTarget] = useState(null)
  const [deletingFolder, setDeletingFolder] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)

  const unfiledArtworks = useMemo(
    () => artworks.filter((artwork) => !artwork.folderId),
    [artworks],
  )

  const visibleArtworks = useMemo(() => {
    switch (view) {
      case GALLERY_VIEWS.ALL:
        return artworks
      case GALLERY_VIEWS.FOLDER:
        return artworks.filter((artwork) => artwork.folderId === selectedFolderId)
      case GALLERY_VIEWS.UNFILED:
        return unfiledArtworks
      case GALLERY_VIEWS.HOME:
      default:
        return unfiledArtworks
    }
  }, [view, artworks, selectedFolderId, unfiledArtworks])

  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) || null
  const currentFolderId =
    view === GALLERY_VIEWS.FOLDER ? selectedFolderId : null

  function openFolder(folderId) {
    setSelectedFolderId(folderId)
    setView(GALLERY_VIEWS.FOLDER)
    setSelectedArtwork(null)
  }

  function goHome() {
    setView(GALLERY_VIEWS.HOME)
    setSelectedFolderId(null)
    setSelectedArtwork(null)
  }

  function showAllArtwork() {
    setView(GALLERY_VIEWS.ALL)
    setSelectedFolderId(null)
    setSelectedArtwork(null)
  }

  function showUnfiled() {
    setView(GALLERY_VIEWS.UNFILED)
    setSelectedFolderId(null)
    setSelectedArtwork(null)
  }

  function handleGalleryContextMenu(event) {
    if (event.target.closest('.folder-card, .artwork-card, .gallery-toolbar, button, a, input, select, textarea')) {
      return
    }

    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY })
  }

  async function handleToggleFavorite(artwork) {
    try {
      await toggleFavorite(artwork.id)
      if (selectedArtwork?.id === artwork.id) {
        setSelectedArtwork({ ...artwork, favorite: !artwork.favorite })
      }
    } catch {
      // Error handled by context
    }
  }

  async function handleDeleteArtwork() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await removeArtwork(deleteTarget.id)
      setDeleteTarget(null)
      setSelectedArtwork(null)
    } catch {
      // Keep dialog open on error
    } finally {
      setDeleting(false)
    }
  }

  async function handleCreateFolder(name) {
    setFolderSaving(true)
    try {
      await createFolder(name)
      setFolderDialog(null)
    } finally {
      setFolderSaving(false)
    }
  }

  async function handleRenameFolder(name) {
    if (!folderDialog?.folder) return
    setFolderSaving(true)
    try {
      await renameFolder(folderDialog.folder.id, name)
      setFolderDialog(null)
    } finally {
      setFolderSaving(false)
    }
  }

  async function handleDeleteFolder() {
    if (!deleteFolderTarget) return
    setDeletingFolder(true)
    try {
      await removeFolder(deleteFolderTarget.id)
      if (selectedFolderId === deleteFolderTarget.id) {
        goHome()
      }
      setDeleteFolderTarget(null)
    } catch {
      // Keep dialog open on error
    } finally {
      setDeletingFolder(false)
    }
  }

  if (selectedArtwork) {
    const current =
      artworks.find((artwork) => artwork.id === selectedArtwork.id) || selectedArtwork

    return (
      <>
        <ArtworkDetail
          artwork={current}
          folders={folders}
          onBack={() => setSelectedArtwork(null)}
          onEdit={(artwork) => {
            setSelectedArtwork(null)
            onEdit(artwork)
          }}
          onDelete={(artwork) => setDeleteTarget(artwork)}
          onToggleFavorite={handleToggleFavorite}
        />
        <ConfirmDialog
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteArtwork}
          title="Delete Artwork"
          message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
          confirmLabel={deleting ? 'Deleting...' : 'Delete'}
          busy={deleting}
        />
      </>
    )
  }

  const pageTitle =
    view === GALLERY_VIEWS.FOLDER
      ? selectedFolder?.name || 'Folder'
      : view === GALLERY_VIEWS.ALL
        ? 'All Artwork'
        : view === GALLERY_VIEWS.UNFILED
          ? 'Unfiled'
          : 'Gallery'

  const showFolderSection =
    view === GALLERY_VIEWS.HOME || view === GALLERY_VIEWS.ALL

  const showUnfiledHeading =
    view === GALLERY_VIEWS.HOME || view === GALLERY_VIEWS.UNFILED

  return (
    <div
      className="page gallery-page"
      onContextMenu={handleGalleryContextMenu}
    >
      <header className="page-header gallery-header">
        <div className="gallery-header-main">
          {view === GALLERY_VIEWS.FOLDER ? (
            <button type="button" className="btn btn--ghost btn--sm" onClick={goHome}>
              <ArrowLeft size={16} />
              Back to Gallery
            </button>
          ) : null}
          <div>
            <h2 className="page-title">{pageTitle}</h2>
            {!loading && visibleArtworks.length > 0 && view !== GALLERY_VIEWS.HOME && (
              <p className="page-subtitle">
                {visibleArtworks.length} artwork{visibleArtworks.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        <div className="gallery-toolbar">
          {view !== GALLERY_VIEWS.ALL && view !== GALLERY_VIEWS.FOLDER && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={showAllArtwork}>
              All artwork
            </button>
          )}
          {view === GALLERY_VIEWS.ALL && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={goHome}>
              Back to folders
            </button>
          )}
          {view !== GALLERY_VIEWS.UNFILED && view !== GALLERY_VIEWS.FOLDER && unfiledArtworks.length > 0 && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={showUnfiled}>
              Unfiled ({unfiledArtworks.length})
            </button>
          )}
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => setFolderDialog({ mode: 'create' })}
            aria-label="Create new folder"
          >
            <FolderPlus size={16} />
            New Folder
          </button>
          {view === GALLERY_VIEWS.FOLDER && (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => onAdd(currentFolderId)}
            >
              Add Artwork
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-state">Loading your gallery...</div>
      ) : (
        <>
          {showFolderSection && (
            <section className="gallery-folders" aria-label="Folders">
              <div className="gallery-section-header">
                <h3 className="gallery-section-title">Folders</h3>
              </div>

              {folders.length === 0 ? (
                <div className="gallery-folders-empty">
                  <p>No folders yet. Create one to organize your artwork.</p>
                </div>
              ) : (
                <div className="folder-grid">
                  {folders.map((folder) => (
                    <FolderCard
                      key={folder.id}
                      folder={folder}
                      onOpen={openFolder}
                      onRename={(item) => setFolderDialog({ mode: 'rename', folder: item })}
                      onDelete={setDeleteFolderTarget}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="gallery-artworks" aria-label="Artwork">
            {showUnfiledHeading && (
              <div className="gallery-section-header">
                <h3 className="gallery-section-title">
                  {view === GALLERY_VIEWS.UNFILED ? 'Unfiled Artwork' : 'Unfiled'}
                </h3>
                {view === GALLERY_VIEWS.HOME && unfiledArtworks.length > 0 && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={showUnfiled}>
                    View all unfiled
                  </button>
                )}
              </div>
            )}

            {visibleArtworks.length === 0 ? (
              view === GALLERY_VIEWS.FOLDER ? (
                <div className="empty-state">
                  <div className="empty-state-icon" aria-hidden="true">
                    <ImageIcon size={40} strokeWidth={1.5} />
                  </div>
                  <h2 className="empty-state-title">This folder is empty</h2>
                  <p className="empty-state-text">
                    Add artwork to &ldquo;{selectedFolder?.name}&rdquo; or move existing pieces here.
                  </p>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => onAdd(currentFolderId)}
                  >
                    Add Artwork to Folder
                  </button>
                </div>
              ) : view === GALLERY_VIEWS.HOME && folders.length === 0 ? (
                <EmptyState onAdd={() => onAdd(null)} />
              ) : (
                <div className="empty-state">
                  <h2 className="empty-state-title">No unfiled artwork</h2>
                  <p className="empty-state-text">
                    Artwork not in a folder will appear here.
                  </p>
                </div>
              )
            ) : (
              <div className="artwork-grid">
                {visibleArtworks.map((artwork) => (
                  <ArtworkCard
                    key={artwork.id}
                    artwork={artwork}
                    folders={folders}
                    onClick={setSelectedArtwork}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <FolderNameDialog
        isOpen={folderDialog?.mode === 'create'}
        onClose={() => setFolderDialog(null)}
        onSubmit={handleCreateFolder}
        title="New Folder"
        submitLabel="Create Folder"
        saving={folderSaving}
      />

      <FolderNameDialog
        isOpen={folderDialog?.mode === 'rename'}
        onClose={() => setFolderDialog(null)}
        onSubmit={handleRenameFolder}
        title="Rename Folder"
        initialName={folderDialog?.folder?.name || ''}
        submitLabel="Save"
        saving={folderSaving}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteFolderTarget)}
        onClose={() => setDeleteFolderTarget(null)}
        onConfirm={handleDeleteFolder}
        title="Delete Folder"
        message={`Delete "${deleteFolderTarget?.name}"? The ${deleteFolderTarget?.count || 0} artwork${deleteFolderTarget?.count === 1 ? '' : 's'} inside will be moved to Unfiled. The artwork will not be deleted.`}
        confirmLabel={deletingFolder ? 'Deleting...' : 'Delete Folder'}
        busy={deletingFolder}
      />

      <GalleryContextMenu
        isOpen={Boolean(contextMenu)}
        x={contextMenu?.x || 0}
        y={contextMenu?.y || 0}
        onClose={() => setContextMenu(null)}
        onNewFolder={() => setFolderDialog({ mode: 'create' })}
      />
    </div>
  )
}
