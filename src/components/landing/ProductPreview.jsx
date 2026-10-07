const PRINTS = [
  {
    tone: 'digital',
    title: 'Morning Study',
    meta: 'Digital · Finished',
    className: 'collage-print--a',
    angle: '-5deg',
  },
  {
    tone: 'traditional',
    title: 'Charcoal Portrait',
    meta: 'Traditional · In progress',
    className: 'collage-print--b',
    angle: '4deg',
  },
  {
    tone: 'warm',
    title: 'Color Sketches',
    meta: 'Pencil · Finished',
    className: 'collage-print--c',
    angle: '-3deg',
  },
]

export default function ProductPreview() {
  return (
    <div className="studio-collage" aria-hidden="true">
      <div className="collage-stack">
        {PRINTS.map((print) => (
          <figure
            key={print.title}
            className={`collage-print ${print.className}`}
            style={{ '--print-angle': print.angle }}
          >
            <span className="studio-tape collage-print-tape" />
            <span className={`collage-print-img collage-print-img--${print.tone}`} />
            <figcaption className="collage-print-caption">
              <span className="collage-print-title">{print.title}</span>
              <span className="collage-print-meta">{print.meta}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="collage-folder">
        <span className="collage-folder-label">Sketchbook</span>
        <span className="collage-folder-count">08</span>
        <span className="collage-folder-label">Commissions</span>
        <span className="collage-folder-count">03</span>
      </div>

      <div className="collage-stats">
        <span className="collage-stat-number">24</span>
        <span className="collage-stat-label">artworks</span>
        <span className="collage-stat-divider">/</span>
        <span className="collage-stat-number">86</span>
        <span className="collage-stat-label">hours logged</span>
      </div>

      <p className="collage-note">the work adds up.</p>
    </div>
  )
}
