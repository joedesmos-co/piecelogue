import { BarChart3, Clock, Folder, Heart } from 'lucide-react'

const PREVIEW_CARDS = [
  { title: 'Morning Study', medium: 'Digital', status: 'Finished', tone: 'digital', favorite: true },
  { title: 'Charcoal Portrait', medium: 'Traditional', status: 'In Progress', tone: 'traditional', favorite: false },
  { title: 'Color Sketches', medium: 'Pencil', status: 'Finished', tone: 'warm', favorite: false },
]

const PREVIEW_FOLDERS = [
  { name: 'Sketchbook', count: 8 },
  { name: 'Commissions', count: 3 },
]

export default function ProductPreview() {
  return (
    <div className="product-preview" aria-hidden="true">
      <div className="product-preview-window">
        <div className="product-preview-topbar">
          <span className="product-preview-dot" />
          <span className="product-preview-dot" />
          <span className="product-preview-dot" />
          <span className="product-preview-topbar-title">Gallery</span>
        </div>

        <div className="product-preview-body">
          <div className="product-preview-folders">
            {PREVIEW_FOLDERS.map((folder) => (
              <div key={folder.name} className="product-preview-folder">
                <Folder size={14} strokeWidth={1.75} />
                <span>{folder.name}</span>
                <span className="product-preview-folder-count">{folder.count}</span>
              </div>
            ))}
          </div>

          <div className="product-preview-grid">
            {PREVIEW_CARDS.map((card) => (
              <div key={card.title} className="product-preview-card">
                <div className={`product-preview-thumb product-preview-thumb--${card.tone}`} />
                <div className="product-preview-card-body">
                  <div className="product-preview-card-title">{card.title}</div>
                  <div className="product-preview-card-meta">
                    <span className="badge badge--medium-type">{card.medium}</span>
                    <span
                      className={`badge badge--status badge--${card.status === 'Finished' ? 'finished' : 'progress'}`}
                    >
                      {card.status}
                    </span>
                  </div>
                  {card.favorite && (
                    <span className="product-preview-favorite">
                      <Heart size={12} fill="currentColor" />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="product-preview-stats">
            <div className="product-preview-stat">
              <BarChart3 size={16} strokeWidth={1.75} />
              <div>
                <span className="product-preview-stat-value">24</span>
                <span className="product-preview-stat-label">Artworks</span>
              </div>
            </div>
            <div className="product-preview-stat">
              <Clock size={16} strokeWidth={1.75} />
              <div>
                <span className="product-preview-stat-value">86h</span>
                <span className="product-preview-stat-label">Tracked</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
