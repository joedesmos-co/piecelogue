import { useEffect, useState } from 'react'
import { ArtworkProvider } from './context/ArtworkProvider'
import { useArtworks } from './hooks/useArtworks'
import { usePublicRoute } from './hooks/usePublicRoute'
import AppShell from './components/AppShell'
import Modal from './components/Modal'
import ArtworkForm from './components/ArtworkForm'
import GalleryPage from './pages/GalleryPage'
import StatsPage from './pages/StatsPage'
import SettingsPage from './pages/SettingsPage'
import PublicSite from './pages/public/PublicSite'
import HomeStructuredData from './components/HomeStructuredData'
import { PAGES } from './utils/constants'
import { applyPageSeo } from './utils/seo'
import { PAGE_SEO } from './utils/site'

function AppContent() {
  const { addArtwork, editArtwork, folders } = useArtworks()
  const [currentPage, setCurrentPage] = useState(PAGES.GALLERY)
  const [showForm, setShowForm] = useState(false)
  const [editingArtwork, setEditingArtwork] = useState(null)
  const [defaultFolderId, setDefaultFolderId] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    applyPageSeo(PAGE_SEO.home)
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
      case PAGES.STATS:
        return <StatsPage />
      case PAGES.SETTINGS:
        return <SettingsPage />
      case PAGES.GALLERY:
      default:
        return <GalleryPage onAdd={handleAdd} onEdit={handleEdit} />
    }
  }

  return (
    <>
      <HomeStructuredData />
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

export default function App() {
  const publicRoute = usePublicRoute()

  if (publicRoute) {
    return <PublicSite route={publicRoute} />
  }

  return (
    <ArtworkProvider>
      <AppContent />
    </ArtworkProvider>
  )
}
