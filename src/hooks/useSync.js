import { useContext } from 'react'
import { SyncContext } from '../context/syncContext'

export function useSync() {
  const context = useContext(SyncContext)
  if (!context) {
    throw new Error('useSync must be used within SyncProvider')
  }
  return context
}
