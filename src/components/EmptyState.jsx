import { Palette, Plus } from 'lucide-react'

export default function EmptyState({ onAdd }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">
        <Palette size={40} strokeWidth={1.5} />
      </div>
      <h2 className="empty-state-title">Your gallery is empty</h2>
      <p className="empty-state-text">
        Start logging your creative journey. Add your first artwork to begin
        tracking your progress.
      </p>
      <button type="button" className="btn btn--primary" onClick={onAdd}>
        <Plus size={18} />
        Add Your First Artwork
      </button>
    </div>
  )
}
