import { useMemo, useState } from 'react'
import { FolderPlus, ImageIcon } from 'lucide-react'
import { useArtworks } from '../hooks/useArtworks'
import { useAuth } from '../hooks/useAuth'
import { wasLibraryClearedOnSignOut } from '../utils/clearLocalLibrary'
import { GALLERY_VIEWS } from '../utils/constants'
import {
  getDescendantFolderIds,
  getFolderBreadcrumbs,
  getFolderPickerOptions,
  normalizeParentFolderId,
} from '../utils/folderTree'
import ArtworkCard from '../components/ArtworkCard'
import ArtworkDetail from '../components/ArtworkDetail'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import DeleteFolderDialog from '../components/DeleteFolderDialog'
import FolderCard from '../components/FolderCard'
import FolderNameDialog from '../components/FolderNameDialog'
import GalleryBreadcrumbs from '../components/GalleryBreadcrumbs'
import GalleryContextMenu from '../components/GalleryContextMenu'
import LoadingState from '../components/LoadingState'
import ArtworkActionsSheet from '../components/ArtworkActionsSheet'
import MoveToFolderSheet from '../components/MoveToFolderSheet'

export default function GalleryPage({ onAdd, onEdit }) {
  const { authenticated } = useAuth()
  const {
    artworks,
    folders,
    loading,
    error,
    removeArtwork,
    toggleFavorite,
    moveArtworkToFolder,
    createFolder,
    updateFolder,
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
  const [actionArtwork, setActionArtwork] = useState(null)
  const [moveTargetArtwork, setMoveTargetArtwork] = useState(null)
  const [movingArtwork, setMovingArtwork] = useState(false)
  const [dragArtworkId, setDragArtworkId] = useState(null)
  const [dropFolderId, setDropFolderId] = useState(null)

  const unfiledArtworks = useMemo(
    () => artworks.filter((artwork) => !artwork.folderId),
    [artworks],
  )

  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) || null
  const currentFolderId = view === GALLERY_VIEWS.FOLDER ? selectedFolderId : null
  const breadcrumbs = useMemo(
    () => (selectedFolderId ? getFolderBreadcrumbs(selectedFolderId, folders) : []),
    [selectedFolderId, folders],
  )

  const visibleChildFolders = useMemo(() => {
    const parentId = view === GALLERY_VIEWS.FOLDER ? selectedFolderId : null
    return folders.filter(
      (folder) => normalizeParentFolderId(folder.parentFolderId) === parentId,
    )
  }, [folders, view, selectedFolderId])

  const visibleArtworks = useMemo(() => {
    switch (view) {
      case GALLERY_VIEWS.FOLDER:
        return artworks.filter((artwork) => artwork.folderId === selectedFolderId)
      case GALLERY_VIEWS.UNFILED:
        return unfiledArtworks
      case GALLERY_VIEWS.HOME:
      default:
        return unfiledArtworks
    }
  }, [view, artworks, selectedFolderId, unfiledArtworks])

  const createParentFolderId =
    folderDialog?.mode === 'create'
      ? folderDialog.parentFolderId ?? currentFolderId
      : null

  const renameParentOptions = useMemo(() => {
    if (!folderDialog?.folder) {
      return []
    }

    const excludeIds = [
      folderDialog.folder.id,
      ...getDescendantFolderIds(folderDialog.folder.id, folders),
    ]

    return getFolderPickerOptions(folders, { excludeFolderIds: excludeIds })
  }, [folderDialog, folders])

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

  function showUnfiled() {
    setView(GALLERY_VIEWS.UNFILED)
    setSelectedFolderId(null)
    setSelectedArtwork(null)
  }

  function handleBreadcrumbNavigate(index) {
    if (index < 0) {
      goHome()
      return
    }

    const crumb = breadcrumbs[index]
    if (crumb) {
      openFolder(crumb.id)
    }
  }

  function handleGalleryContextMenu(event) {
    if (event.target.closest('.folder-card, .artwork-card, .gallery-toolbar, button, a, input, select, textarea')) {
      return
    }

    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY })
  }

  async function handleMoveArtworkToFolder(artwork, folderId) {
    setMovingArtwork(true)
    try {
      await moveArtworkToFolder(artwork.id, folderId)
      setMoveTargetArtwork(null)
      setActionArtwork(null)
    } finally {
      setMovingArtwork(false)
    }
  }

  function handleDragStart(artwork) {
    setDragArtworkId(artwork.id)
    setDropFolderId(null)
  }

  function handleDragMove(_artwork, event) {
    const element = document.elementFromPoint(event.clientX, event.clientY)
    const folderCard = element?.closest('[data-folder-id]')
    const nextFolderId = folderCard?.getAttribute('data-folder-id') ?? null
    setDropFolderId(nextFolderId)

    const edge = 72
    if (event.clientY < edge) {
      window.scrollBy({ top: -10, behavior: 'auto' })
    } else if (window.innerHeight - event.clientY < edge) {
      window.scrollBy({ top: 10, behavior: 'auto' })
    }
  }

  async function handleDragEnd(artwork, _event, meta = {}) {
    const targetFolderId = dropFolderId
    setDragArtworkId(null)
    setDropFolderId(null)

    if (meta.cancelled || !targetFolderId || targetFolderId === artwork.folderId) {
      return
    }

    await handleMoveArtworkToFolder(artwork, targetFolderId)
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

  async function handleCreateFolder({ name, parentFolderId }) {
    setFolderSaving(true)
    try {
      await createFolder(name, parentFolderId)
      setFolderDialog(null)
    } finally {
      setFolderSaving(false)
    }
  }

  async function handleUpdateFolder({ name, parentFolderId }) {
    if (!folderDialog?.folder) return
    setFolderSaving(true)
    try {
      await updateFolder(folderDialog.folder.id, { name, parentFolderId })
      setFolderDialog(null)
    } finally {
      setFolderSaving(false)
    }
  }

  async function handleDeleteFolder({ moveContentsTo }) {
    if (!deleteFolderTarget) return
    setDeletingFolder(true)
    try {
      await removeFolder(deleteFolderTarget.id, { moveContentsTo })
      if (selectedFolderId === deleteFolderTarget.id) {
        const parentId = normalizeParentFolderId(deleteFolderTarget.parentFolderId)
        if (parentId) {
          openFolder(parentId)
        } else {
          goHome()
        }
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
      : view === GALLERY_VIEWS.UNFILED
        ? 'Unfiled'
        : 'Gallery'

  const showFolderSection = view === GALLERY_VIEWS.HOME || view === GALLERY_VIEWS.FOLDER
  const showUnfiledHeading = view === GALLERY_VIEWS.HOME || view === GALLERY_VIEWS.UNFILED
  const hasAnyArtwork = artworks.length > 0

  return (
    <div
      className="page gallery-page"
      onContextMenu={handleGalleryContextMenu}
    >
      <header className="page-header gallery-header">
        <div className="gallery-header-main">
          {view === GALLERY_VIEWS.FOLDER ? (
            <GalleryBreadcrumbs crumbs={breadcrumbs} onNavigate={handleBreadcrumbNavigate} />
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
          {view !== GALLERY_VIEWS.UNFILED && view !== GALLERY_VIEWS.FOLDER && unfiledArtworks.length > 0 && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={showUnfiled}>
              Unfiled ({unfiledArtworks.length})
            </button>
          )}
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() =>
              setFolderDialog({ mode: 'create', parentFolderId: currentFolderId })
            }
            aria-label="Create new folder"
          >
            <FolderPlus size={16} />
            {view === GALLERY_VIEWS.FOLDER ? 'New Subfolder' : 'New Folder'}
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
        <LoadingState message="Loading your gallery..." />
      ) : (
        <>
          {showFolderSection && (
            <section className="gallery-folders" aria-label="Folders">
              <div className="gallery-section-header">
                <h3 className="gallery-section-title">
                  {view === GALLERY_VIEWS.FOLDER ? 'Subfolders' : 'Folders'}
                </h3>
              </div>

              {visibleChildFolders.length === 0 ? (
                <div className="gallery-folders-empty">
                  <p>
                    {view === GALLERY_VIEWS.FOLDER
                      ? 'No subfolders yet.'
                      : 'No folders yet. Create one to organize your artwork.'}
                  </p>
                </div>
              ) : (
                <div className="folder-grid">
                  {visibleChildFolders.map((folder) => (
                    <FolderCard
                      key={folder.id}
                      folder={folder}
                      onOpen={openFolder}
                      onRename={(item) => setFolderDialog({ mode: 'rename', folder: item })}
                      onDelete={setDeleteFolderTarget}
                      onNewSubfolder={(item) =>
                        setFolderDialog({ mode: 'create', parentFolderId: item.id })
                      }
                      onMoveFolder={(item) =>
                        setFolderDialog({ mode: 'rename', folder: item })
                      }
                      isDropTarget={Boolean(dragArtworkId)}
                      dropTargetActive={dropFolderId === folder.id}
                      onDropArtwork={(folderId) => {
                        const artwork = artworks.find((item) => item.id === dragArtworkId)
                        if (artwork) {
                          handleMoveArtworkToFolder(artwork, folderId)
                        }
                        setDragArtworkId(null)
                        setDropFolderId(null)
                      }}
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
                visibleChildFolders.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon" aria-hidden="true">
                      <ImageIcon size={40} strokeWidth={1.5} />
                    </div>
                    <h2 className="empty-state-title">This folder is empty</h2>
                    <p className="empty-state-text">
                      Add artwork to &ldquo;{selectedFolder?.name}&rdquo; or create a subfolder.
                    </p>
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => onAdd(currentFolderId)}
                    >
                      Add artwork to folder
                    </button>
                  </div>
                ) : null
              ) : view === GALLERY_VIEWS.HOME && !hasAnyArtwork ? (
                <EmptyState
                  onAdd={() => onAdd(null)}
                  signedOut={!authenticated && wasLibraryClearedOnSignOut()}
                />
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon" aria-hidden="true">
                    <ImageIcon size={40} strokeWidth={1.5} />
                  </div>
                  <h2 className="empty-state-title">
                    {view === GALLERY_VIEWS.UNFILED ? 'No unfiled artwork' : 'No unfiled artwork here'}
                  </h2>
                  <p className="empty-state-text">
                    {view === GALLERY_VIEWS.UNFILED
                      ? 'Pieces without a folder appear here. Add artwork from the Gallery or move items out of folders.'
                      : 'Artwork stored in folders does not appear here. Open a folder to view it, or add new unfiled work.'}
                  </p>
                  {view === GALLERY_VIEWS.UNFILED ? (
                    <button type="button" className="btn btn--primary" onClick={() => onAdd(null)}>
                      Add unfiled artwork
                    </button>
                  ) : null}
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
                    onOpenActions={setActionArtwork}
                    onDragStart={handleDragStart}
                    onDragMove={handleDragMove}
                    onDragEnd={handleDragEnd}
                    isDragging={Boolean(dragArtworkId)}
                    isDragSource={dragArtworkId === artwork.id}
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
        title={view === GALLERY_VIEWS.FOLDER ? 'New Subfolder' : 'New Folder'}
        initialParentFolderId={createParentFolderId}
        parentOptions={getFolderPickerOptions(folders)}
        submitLabel="Create Folder"
        saving={folderSaving}
      />

      <FolderNameDialog
        isOpen={folderDialog?.mode === 'rename'}
        onClose={() => setFolderDialog(null)}
        onSubmit={handleUpdateFolder}
        title="Edit Folder"
        initialName={folderDialog?.folder?.name || ''}
        initialParentFolderId={folderDialog?.folder?.parentFolderId ?? null}
        parentOptions={renameParentOptions}
        submitLabel="Save"
        saving={folderSaving}
      />

      <DeleteFolderDialog
        isOpen={Boolean(deleteFolderTarget)}
        onClose={() => setDeleteFolderTarget(null)}
        onConfirm={handleDeleteFolder}
        folder={deleteFolderTarget}
        busy={deletingFolder}
      />

      <GalleryContextMenu
        isOpen={Boolean(contextMenu)}
        x={contextMenu?.x || 0}
        y={contextMenu?.y || 0}
        onClose={() => setContextMenu(null)}
        onNewFolder={() =>
          setFolderDialog({ mode: 'create', parentFolderId: currentFolderId })
        }
      />

      <ArtworkActionsSheet
        isOpen={Boolean(actionArtwork)}
        artwork={actionArtwork}
        onClose={() => setActionArtwork(null)}
        onMove={(artwork) => {
          setActionArtwork(null)
          setMoveTargetArtwork(artwork)
        }}
        onEdit={(artwork) => {
          setActionArtwork(null)
          onEdit(artwork)
        }}
        onToggleFavorite={async (artwork) => {
          setActionArtwork(null)
          await handleToggleFavorite(artwork)
        }}
        onDelete={(artwork) => {
          setActionArtwork(null)
          setDeleteTarget(artwork)
        }}
      />

      <MoveToFolderSheet
        isOpen={Boolean(moveTargetArtwork)}
        artwork={moveTargetArtwork}
        folders={folders}
        onClose={() => setMoveTargetArtwork(null)}
        onMove={handleMoveArtworkToFolder}
        moving={movingArtwork}
      />
    </div>
  )
}
