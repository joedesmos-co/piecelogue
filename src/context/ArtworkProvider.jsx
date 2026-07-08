import { useCallback, useEffect, useState } from 'react'
import { ArtworkContext } from './artworkContext'
import * as artworkService from '../db/artworkService'
import * as folderService from '../db/folderService'

export function ArtworkProvider({ children }) {
  const [artworks, setArtworks] = useState([])
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const [artworkData, folderData] = await Promise.all([
        artworkService.getAllArtworks(),
        folderService.getAllFolders(),
      ])
      setArtworks(artworkData)
      setFolders(folderData)
    } catch (err) {
      setError(err.message || 'Failed to load gallery.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setError(null)
        const [artworkData, folderData] = await Promise.all([
          artworkService.getAllArtworks(),
          folderService.getAllFolders(),
        ])
        if (!cancelled) {
          setArtworks(artworkData)
          setFolders(folderData)
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load gallery.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const addArtwork = useCallback(async (data, imageBlob) => {
    const artwork = await artworkService.createArtwork(data, imageBlob)
    await refresh()
    return artwork
  }, [refresh])

  const editArtwork = useCallback(async (id, data, imageBlob) => {
    const artwork = await artworkService.updateArtwork(id, data, imageBlob)
    await refresh()
    return artwork
  }, [refresh])

  const removeArtwork = useCallback(async (id) => {
    await artworkService.deleteArtwork(id)
    await refresh()
  }, [refresh])

  const toggleFavorite = useCallback(async (id) => {
    const artwork = await artworkService.toggleFavorite(id)
    await refresh()
    return artwork
  }, [refresh])

  const createFolder = useCallback(async (name) => {
    const folder = await folderService.createFolder(name)
    await refresh()
    return folder
  }, [refresh])

  const renameFolder = useCallback(async (id, name) => {
    const folder = await folderService.renameFolder(id, name)
    await refresh()
    return folder
  }, [refresh])

  const removeFolder = useCallback(async (id) => {
    const folder = await folderService.deleteFolder(id)
    await refresh()
    return folder
  }, [refresh])

  const value = {
    artworks,
    folders,
    loading,
    error,
    refresh,
    addArtwork,
    editArtwork,
    removeArtwork,
    toggleFavorite,
    createFolder,
    renameFolder,
    removeFolder,
  }

  return (
    <ArtworkContext.Provider value={value}>{children}</ArtworkContext.Provider>
  )
}
