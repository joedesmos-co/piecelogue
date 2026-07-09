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
  const { addArtwork, editArtwork, folders } = useArtworks()
  const [currentPage, setCurrentPage] = useState(getInitialPage)
  const [showForm, setShowForm] = useState(false)
  const [editingArtwork, setEditingArtwork] = useState(null)
  const [defaultFolderId, setDefaultFolderId] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    applyPageSeo(PAGE_SEO.app)
  }, [])

  function handleAdd(folderId = null) {
    setEditingArtwork(null)
    setDefaultFolderId(folderId)
    setShowForm(true)
  }

  function handleEdit(artwork) {
    setEditingArtwork(artwork)
    setDefaultFolderId(artwork.folderId || null)
    setShowForm(true)
  }

  function handleCloseForm() {
    setShowForm(false)
    setEditingArtwork(null)
    setDefaultFolderId(null)
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
      >
        {renderPage()}
      </AppShell>

      <Modal
        isOpen={showForm}
        onClose={saving ? () => {} : handleCloseForm}
        closeOnBackdrop={!saving}
        title={editingArtwork ? 'Edit Artwork' : 'Add Artwork'}
        className="modal--form"
      >
        <ArtworkForm
          key={editingArtwork?.id || `new-${defaultFolderId || 'none'}`}
          artwork={editingArtwork}
          folders={folders}
          defaultFolderId={defaultFolderId}
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
