import { Plus } from 'lucide-react'
import { SketchArrow } from './StudioMarks'

export default function EmptyState({
  onAdd,
  signedOut = false,
  title,
  message,
  actionLabel = 'Add your first artwork',
  note = 'Every collection starts with one piece.',
}) {
  const heading =
    title ||
    (signedOut ? 'Sign in to see your library.' : 'Make your first mark.')
  const description =
    message ||
    (signedOut
      ? 'Your local library on this device was cleared when you signed out. Sign in on Profile to restore from cloud, or add artwork to start a new local collection.'
      : 'A sketch, a finished piece, an experiment. Start with something you made. This is your wall.')

  return (
    <div className="studio-empty">
      <div className="studio-empty-poster">
        <span className="studio-empty-kicker">
          Piecelogue / your growing collection
        </span>
        <div className="studio-empty-frame">
          <h3>{heading}</h3>
        </div>
        <div className="studio-empty-caption">
          <span aria-hidden="true">[ a work in becoming ]</span>
          <span aria-hidden="true">Your studio</span>
        </div>
        {onAdd && (
          <button type="button" className="studio-empty-add" onClick={onAdd}>
            <Plus size={24} aria-hidden="true" />
            {signedOut ? 'Add artwork' : actionLabel}
          </button>
        )}
      </div>
      <div className="studio-empty-note">
        <p className="studio-empty-handwriting">{note}</p>
        <SketchArrow className="studio-empty-arrow" />
        <p className="studio-empty-description">{description}</p>
      </div>
    </div>
  )
}
