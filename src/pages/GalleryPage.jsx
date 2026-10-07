import { useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  FolderPlus,
  LayoutGrid,
  List,
  Plus,
  Search,
  X,
} from 'lucide-react'
import { useArtworks } from '../hooks/useArtworks'
import { useAuth } from '../hooks/useAuth'
import { useSync } from '../hooks/useSync'
import { wasLibraryClearedOnSignOut } from '../utils/clearLocalLibrary'
import { GALLERY_VIEWS } from '../utils/constants'
import {
  getDescendantFolderIds,
  getFolderBreadcrumbs,
  getFolderPickerOptions,
  normalizeParentFolderId,
} from '../utils/folderTree'
import ArtworkCard from '../components/ArtworkCard'
import { BrushMark } from '../components/StudioMarks'
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
import { shouldTriggerEdgeBackSwipe } from '../utils/gestures'

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
    refresh,
  } = useArtworks()
  const { retryNow, wakeSync } = useSync()

  const [view, setView] = useState(GALLERY_VIEWS.HOME)
  const [search, setSearch] = useState('')
  const [layout, setLayout] = useState('grid')
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
  // Artwork Detail swipe context: the visible collection the user opened, so
  // next/previous stays inside the same folder scope + sort/filter order.
  const [detailIds, setDetailIds] = useState([])
  const [detailIndex, setDetailIndex] = useState(-1)
  const edgeSwipeRef = useRef(null)

  const unfiledArtworks = useMemo(
    () => artworks.filter((artwork) => !artwork.folderId),
    [artworks],
  )

  const selectedFolder =
    folders.find((folder) => folder.id === selectedFolderId) || null
  const currentFolderId =
    view === GALLERY_VIEWS.FOLDER ? selectedFolderId : null
  const breadcrumbs = useMemo(
    () =>
      selectedFolderId ? getFolderBreadcrumbs(selectedFolderId, folders) : [],
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
        return artworks.filter(
          (artwork) => artwork.folderId === selectedFolderId,
        )
      case GALLERY_VIEWS.UNFILED:
        return unfiledArtworks
      case GALLERY_VIEWS.HOME:
      default:
        return unfiledArtworks
    }
  }, [view, artworks, selectedFolderId, unfiledArtworks])

  const matchingArtworks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return query
      ? visibleArtworks.filter((artwork) =>
          [
            artwork.title,
            artwork.medium,
            artwork.mediumType,
            artwork.status,
          ].some((value) => value?.toLocaleLowerCase().includes(query)),
        )
      : visibleArtworks
  }, [visibleArtworks, search])

  const createParentFolderId =
    folderDialog?.mode === 'create'
      ? (folderDialog.parentFolderId ?? currentFolderId)
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
    setDetailIds([])
    setDetailIndex(-1)
  }

  function goHome() {
    setView(GALLERY_VIEWS.HOME)
    setSelectedFolderId(null)
    setSelectedArtwork(null)
    setDetailIds([])
    setDetailIndex(-1)
  }

  function showUnfiled() {
    setView(GALLERY_VIEWS.UNFILED)
    setSelectedFolderId(null)
    setSelectedArtwork(null)
    setDetailIds([])
    setDetailIndex(-1)
  }

  /** Go to the immediate parent folder (or Gallery root for top-level). */
  function goToParentFolder() {
    if (view !== GALLERY_VIEWS.FOLDER) return
    const parentId = normalizeParentFolderId(selectedFolder?.parentFolderId)
    if (parentId) {
      openFolder(parentId)
    } else {
      goHome()
    }
  }

  /** iOS-style edge swipe back: left-edge touch, horizontal move right. */
  function handleGalleryTouchStart(event) {
    if (view !== GALLERY_VIEWS.FOLDER) {
      edgeSwipeRef.current = null
      return
    }
    if (event.touches.length !== 1) {
      edgeSwipeRef.current = null
      return
    }
    const touch = event.touches[0]
    // Never start from drag/long-press, horizontal strips, or controls.
    if (
      dragArtworkId ||
      touch.clientX > 28 ||
      event.target.closest(
        'button, a, input, select, textarea, .folder-card, .artwork-card, .gallery-toolbar, [data-no-edge-swipe]',
      )
    ) {
      edgeSwipeRef.current = null
      return
    }
    edgeSwipeRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
    }
  }

  function handleGalleryTouchEnd(event) {
    const start = edgeSwipeRef.current
    edgeSwipeRef.current = null
    if (!start || view !== GALLERY_VIEWS.FOLDER) return
    const touch = event.changedTouches[0]
    if (!touch) return
    if (
      shouldTriggerEdgeBackSwipe({
        startX: start.startX,
        startY: start.startY,
        endX: touch.clientX,
        endY: touch.clientY,
        durationMs: Date.now() - start.startTime,
      })
    ) {
      goToParentFolder()
    }
  }

  function openArtworkDetail(artwork, collection = matchingArtworks) {
    const list = Array.isArray(collection) ? collection : matchingArtworks
    const index = list.findIndex((item) => item.id === artwork.id)
    setDetailIds(list.map((item) => item.id))
    setDetailIndex(index >= 0 ? index : -1)
    setSelectedArtwork(artwork)
  }

  function stepDetail(direction) {
    if (!detailIds.length || detailIndex < 0) return
    const nextIndex = direction === 'next' ? detailIndex + 1 : detailIndex - 1
    if (nextIndex < 0 || nextIndex >= detailIds.length) return
    const nextId = detailIds[nextIndex]
    const next = artworks.find((item) => item.id === nextId)
    if (!next) return
    setDetailIndex(nextIndex)
    setSelectedArtwork(next)
  }

  function closeArtworkDetail() {
    setSelectedArtwork(null)
    setDetailIds([])
    setDetailIndex(-1)
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
    if (
      event.target.closest(
        '.folder-card, .artwork-card, .gallery-toolbar, button, a, input, select, textarea',
      )
    ) {
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

    if (
      meta.cancelled ||
      !targetFolderId ||
      targetFolderId === artwork.folderId
    ) {
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
      // Uses the normal deletion service path (local metadata/images +
      // tombstone/cloud enqueue inside removeArtwork), then clears state and
      // closes any sheet/dialog.
      setDeleteTarget(null)
      setActionArtwork(null)
      if (selectedArtwork?.id === deleteTarget.id) {
        closeArtworkDetail()
      } else {
        setSelectedArtwork(null)
      }
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
        const parentId = normalizeParentFolderId(
          deleteFolderTarget.parentFolderId,
        )
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
      artworks.find((artwork) => artwork.id === selectedArtwork.id) ||
      selectedArtwork

    return (
      <>
        <ArtworkDetail
          artwork={current}
          folders={folders}
          onBack={closeArtworkDetail}
          onEdit={(artwork) => {
            closeArtworkDetail()
            onEdit(artwork)
          }}
          onDelete={(artwork) => setDeleteTarget(artwork)}
          onToggleFavorite={handleToggleFavorite}
          hasPrevious={detailIndex > 0}
          hasNext={detailIndex >= 0 && detailIndex < detailIds.length - 1}
          position={detailIndex >= 0 ? detailIndex + 1 : null}
          total={detailIds.length > 1 ? detailIds.length : null}
          onPrevious={() => stepDetail('prev')}
          onNext={() => stepDetail('next')}
          onImageRepaired={async () => {
            await refresh()
            await retryNow()
            wakeSync()
          }}
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

  const showFolderSection =
    view === GALLERY_VIEWS.HOME || view === GALLERY_VIEWS.FOLDER
  const hasAnyArtwork = artworks.length > 0

  return (
    <div
      className="page gallery-page"
      onContextMenu={handleGalleryContextMenu}
      onTouchStart={handleGalleryTouchStart}
      onTouchEnd={handleGalleryTouchEnd}
    >
      <header className="page-header gallery-header">
        <div className="gallery-header-main">
          {view === GALLERY_VIEWS.FOLDER ? (
            <GalleryBreadcrumbs
              crumbs={breadcrumbs}
              onNavigate={handleBreadcrumbNavigate}
            />
          ) : null}
          {view === GALLERY_VIEWS.UNFILED && (
            <button type="button" className="gallery-back" onClick={goHome}>
              <ArrowLeft size={16} aria-hidden="true" /> Back to Gallery
            </button>
          )}
          <div
            className={`gallery-heading-composition ${view === GALLERY_VIEWS.FOLDER ? 'gallery-heading-composition--folder' : ''}`}
          >
            <div className="gallery-heading-ink">
              <h1 className="gallery-title">{pageTitle}</h1>
              <BrushMark className="gallery-title-stroke" />
            </div>

          </div>
        </div>

        <div className="gallery-toolbar">
          <label className="gallery-search">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              aria-label="Search artworks in this view"
              placeholder="Search artworks…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear artwork search"
              >
                <X size={16} />
              </button>
            )}
          </label>
          <button
            type="button"
            className="btn btn--secondary btn--sm gallery-new-folder"
            onClick={() =>
              setFolderDialog({
                mode: 'create',
                parentFolderId: currentFolderId,
              })
            }
            aria-label="Create new folder"
          >
            <FolderPlus size={18} aria-hidden="true" />
            {view === GALLERY_VIEWS.FOLDER ? 'New Subfolder' : 'New Folder'}
          </button>
          {view === GALLERY_VIEWS.FOLDER && (
            <button
              type="button"
              className="btn btn--primary btn--sm gallery-add-to-folder"
              onClick={() => onAdd(currentFolderId)}
            >
              <Plus size={18} aria-hidden="true" /> Add Artwork
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
                <div className="gallery-section-label">
                  <h2 className="gallery-section-title">
                    {view === GALLERY_VIEWS.FOLDER ? 'Subfolders' : 'Folders'}
                  </h2>
                  <span className="gallery-section-count">
                    {visibleChildFolders.length}
                  </span>
                </div>
              </div>
              <div className="folder-grid">
                {visibleChildFolders.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    onOpen={openFolder}
                    onRename={(item) =>
                      setFolderDialog({ mode: 'rename', folder: item })
                    }
                    onDelete={setDeleteFolderTarget}
                    onNewSubfolder={(item) =>
                      setFolderDialog({
                        mode: 'create',
                        parentFolderId: item.id,
                      })
                    }
                    onMoveFolder={(item) =>
                      setFolderDialog({ mode: 'rename', folder: item })
                    }
                    isDropTarget={Boolean(dragArtworkId)}
                    dropTargetActive={dropFolderId === folder.id}
                    onDropArtwork={(folderId) => {
                      const artwork = artworks.find(
                        (item) => item.id === dragArtworkId,
                      )
                      if (artwork) {
                        handleMoveArtworkToFolder(artwork, folderId)
                      }
                      setDragArtworkId(null)
                      setDropFolderId(null)
                    }}
                  />
                ))}
                <button
                  type="button"
                  className="folder-create-card"
                  onClick={() =>
                    setFolderDialog({
                      mode: 'create',
                      parentFolderId: currentFolderId,
                    })
                  }
                >
                  <Plus size={28} strokeWidth={1.4} aria-hidden="true" />
                  <span>
                    {view === GALLERY_VIEWS.FOLDER
                      ? 'New subfolder'
                      : 'New folder'}
                  </span>
                </button>
              </div>
            </section>
          )}

          <section className="gallery-artworks" aria-label="Artwork">
            <div className="gallery-section-header">
              <div className="gallery-section-label">
                <h2 className="gallery-section-title">
                  {view === GALLERY_VIEWS.UNFILED
                    ? 'Unfiled artwork'
                    : 'Artworks'}
                </h2>
                <span className="gallery-section-count" aria-live="polite">
                  {matchingArtworks.length}
                </span>
                {view === GALLERY_VIEWS.HOME && (
                  <button
                    type="button"
                    className="gallery-scope-label"
                    onClick={showUnfiled}
                    aria-label="View all unfiled artwork"
                  >
                    Unfiled <ArrowUpRight size={12} aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className="gallery-view-controls">
                <div
                  className="gallery-layout-toggle"
                  role="group"
                  aria-label="Artwork layout"
                >
                  <button
                    type="button"
                    aria-label="Grid view"
                    aria-pressed={layout === 'grid'}
                    onClick={() => setLayout('grid')}
                  >
                    <LayoutGrid size={18} />
                  </button>
                  <button
                    type="button"
                    aria-label="List view"
                    aria-pressed={layout === 'list'}
                    onClick={() => setLayout('list')}
                  >
                    <List size={18} />
                  </button>
                </div>
              </div>
            </div>

            {visibleArtworks.length === 0 ? (
              view === GALLERY_VIEWS.FOLDER ? (
                visibleChildFolders.length === 0 ? (
                  <EmptyState
                    title="Room for something good."
                    message={`Add artwork to "${selectedFolder?.name}" or create a subfolder.`}
                    actionLabel="Add artwork to folder"
                    onAdd={() => onAdd(currentFolderId)}
                  />
                ) : null
              ) : view === GALLERY_VIEWS.HOME && !hasAnyArtwork ? (
                <EmptyState
                  onAdd={() => onAdd(null)}
                  signedOut={!authenticated && wasLibraryClearedOnSignOut()}
                />
              ) : (
                <EmptyState
                  title="Everything in its place."
                  message={
                    view === GALLERY_VIEWS.UNFILED
                      ? 'Pieces without a folder appear here. Add artwork from the Gallery or move items out of folders.'
                      : 'Your artwork is tucked into folders. Open one above to see your work, or add a new unfiled piece.'
                  }
                  actionLabel="Add unfiled artwork"
                  onAdd={
                    view === GALLERY_VIEWS.UNFILED
                      ? () => onAdd(null)
                      : undefined
                  }
                />
              )
            ) : matchingArtworks.length === 0 ? (
              <div className="gallery-no-results" role="status">
                <p>No pieces match “{search}”.</p>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => setSearch('')}
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div
                className={`artwork-grid ${layout === 'list' ? 'artwork-grid--list' : ''}`}
              >
                {matchingArtworks.map((artwork) => (
                  <ArtworkCard
                    key={artwork.id}
                    artwork={artwork}
                    folders={folders}
                    onClick={(item) => openArtworkDetail(item)}
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

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteArtwork}
        title="Delete Artwork"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        busy={deleting}
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
