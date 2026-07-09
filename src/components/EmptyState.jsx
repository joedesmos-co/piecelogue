import { Palette, Plus } from 'lucide-react'

export default function EmptyState({ onAdd, signedOut = false }) {
  if (signedOut) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon" aria-hidden="true">
          <Palette size={40} strokeWidth={1.5} />
        </div>
        <h2 className="empty-state-title">Sign in to see your library</h2>
        <p className="empty-state-text">
          Your local library on this device was cleared when you signed out. Sign in on Profile to
          restore from cloud, or add artwork to start a new local collection.
        </p>
        <button type="button" className="btn btn--primary" onClick={onAdd}>
          <Plus size={18} aria-hidden="true" />
          Add artwork
        </button>
      </div>
    )
  }

  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">
        <Palette size={40} strokeWidth={1.5} />
      </div>
      <h2 className="empty-state-title">Your gallery is empty</h2>
      <p className="empty-state-text">
        Add your first artwork to start logging your creative journey. You can organize pieces into
        folders later, and sign in on Profile when you are ready for cloud backup.
      </p>
      <button type="button" className="btn btn--primary" onClick={onAdd}>
        <Plus size={18} aria-hidden="true" />
        Add your first artwork
      </button>
    </div>
  )
}
