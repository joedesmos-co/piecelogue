import { useContext } from 'react'
import { ArtworkContext } from '../context/artworkContext'

export function useArtworks() {
  const context = useContext(ArtworkContext)
  if (!context) {
    throw new Error('useArtworks must be used within ArtworkProvider')
  }
  return context
}
