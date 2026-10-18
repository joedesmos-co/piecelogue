import { useEffect, useState } from 'react'
import { AuthProvider } from './context/AuthProvider'
import { SyncProvider } from './context/SyncProvider'
import { ArtworkProvider } from './context/ArtworkProvider'
import { RestoreProvider } from './context/RestoreProvider'
import { useArtworks } from './hooks/useArtworks'
import AppShell from './components/AppShell'
import Modal from './components/Modal'
import ArtworkForm from './components/ArtworkForm'
import GalleryPage from './pages/GalleryPage'
import ToolsPage from './pages/ToolsPage'
import ProfilePage from './pages/ProfilePage'
import SettingsPage from './pages/SettingsPage'
import { PAGES } from './utils/constants'
import { applyPageSeo } from './utils/seo'
import { PAGE_SEO } from './utils/site'

function getInitialPage() {
  const params = new URLSearchParams(window.location.search)
  if (params.get('auth') === 'success' && params.get('view') === PAGES.PROFILE) {
    return PAGES.PROFILE
  }

  return PAGES.GALLERY
}

function AppContent() {
  const { addArtwork, editArtwork, folders, artworks } = useArtworks()
  const [currentPage, setCurrentPage] = useState(getInitialPage)
  const [showForm, setShowForm] = useState(false)
  const [editingArtwork, setEditingArtwork] = useState(null)
  const [defaultFolderId, setDefaultFolderId] = useState(null)
  const [inspirationPrompt, setInspirationPrompt] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    applyPageSeo(PAGE_SEO.app)
  }, [])

  function handleAdd(folderId = null) {
    setEditingArtwork(null)
    setDefaultFolderId(folderId)
    setShowForm(true)
  }

  function handleStartPiece(prompt) {
    setEditingArtwork(null)
    setDefaultFolderId(null)
    setInspirationPrompt(prompt || null)
    setShowForm(true)
  }

  function handleEdit(artwork) {
    setEditingArtwork(artwork)
    setDefaultFolderId(artwork.folderId || null)
    setInspirationPrompt(null)
    setShowForm(true)
  }

  function handleCloseForm() {
    setShowForm(false)
    setEditingArtwork(null)
    setDefaultFolderId(null)
    setInspirationPrompt(null)
  }

  async function handleSave(data, imageFile) {
    setSaving(true)
    try {
      if (editingArtwork) {
        await editArtwork(editingArtwork.id, data, imageFile)
      } else {
        await addArtwork(data, imageFile)
      }
      handleCloseForm()
    } finally {
      setSaving(false)
    }
  }

  function renderPage() {
    switch (currentPage) {
      case PAGES.PROFILE:
        return <ProfilePage />
      case PAGES.SETTINGS:
        return <SettingsPage />
      case PAGES.TOOLS:
        return <ToolsPage onStartPiece={handleStartPiece} />
      case PAGES.GALLERY:
      default:
        return <GalleryPage onAdd={handleAdd} onEdit={handleEdit} />
    }
  }

  return (
    <>
      <AppShell
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        onAdd={() => handleAdd(null)}
        hideAdd={currentPage === PAGES.GALLERY && artworks.length === 0}
      >
        {renderPage()}
      </AppShell>

      <Modal
        isOpen={showForm}
        onClose={saving ? () => {} : handleCloseForm}
        closeOnBackdrop={!saving}
        title={editingArtwork ? 'Edit Artwork' : inspirationPrompt ? 'Add Artwork' : 'Add Artwork'}
        className="modal--form"
      >
        <ArtworkForm
          key={editingArtwork?.id || `new-${defaultFolderId || 'none'}-${inspirationPrompt ? 'inspired' : 'plain'}`}
          artwork={editingArtwork}
          folders={folders}
          defaultFolderId={defaultFolderId}
          inspiration={inspirationPrompt}
          onSave={handleSave}
          onCancel={handleCloseForm}
          saving={saving}
        />
      </Modal>
    </>
  )
}

export default function LocalApp() {
  return (
    <AuthProvider>
      <SyncProvider>
        <ArtworkProvider>
          <RestoreProvider>
            <AppContent />
          </RestoreProvider>
        </ArtworkProvider>
      </SyncProvider>
    </AuthProvider>
  )
}
