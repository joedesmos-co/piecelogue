import { useContext } from 'react'
import { RestoreContext } from '../context/restoreContext'

export function useRestore() {
  const context = useContext(RestoreContext)
  if (!context) {
    throw new Error('useRestore must be used within RestoreProvider')
  }
  return context
}
