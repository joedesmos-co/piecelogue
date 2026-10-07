// Shared presentational pieces for the Piecelogue studio identity.
// These are decoration and structure only — never interactive content.
import { BrushMark } from './StudioMarks'

export function TapeStrip({ className = '', angle = -6, tone = 'default' }) {
  return (
    <span
      className={`studio-tape studio-tape--${tone} ${className}`}
      style={{ '--tape-angle': `${angle}deg` }}
      aria-hidden="true"
    />
  )
}

export function PaperPanel({
  children,
  className = '',
  tone = 'bone',
  tape = false,
  rotate = 0,
  style,
  as: Tag = 'div',
}) {
  const mergedStyle = rotate
    ? { '--panel-rotate': `${rotate}deg`, ...style }
    : style
  return (
    <Tag
      className={`studio-panel studio-panel--${tone} ${className}`}
      style={mergedStyle}
    >
      {tape ? <TapeStrip className="studio-panel-tape" angle={-5} /> : null}
      {children}
    </Tag>
  )
}

export function StudioLabel({ children, className = '', tone = 'default', as: Tag = 'span' }) {
  return <Tag className={`studio-label studio-label--${tone} ${className}`}>{children}</Tag>
}

export function CatalogMeta({ items, className = '' }) {
  const rows = items.filter(Boolean)
  if (rows.length === 0) return null
  return (
    <dl className={`catalog-meta ${className}`}>
      {rows.map((item) => (
        <div className="catalog-meta-row" key={item.label}>
          <dt className="catalog-meta-label">{item.label}</dt>
          <dd className="catalog-meta-value">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function StudioHeading({
  kicker,
  title,
  note,
  children,
  className = '',
  level = 2,
  id,
}) {
  const Tag = `h${level}`
  return (
    <header className={`studio-heading ${className}`}>
      {kicker ? <p className="studio-heading-kicker">{kicker}</p> : null}
      <div className="studio-heading-ink">
        <Tag id={id} className="studio-heading-title">
          {title}
        </Tag>
        <BrushMark className="studio-heading-stroke" />
      </div>
      {note ? <p className="studio-heading-note">{note}</p> : null}
      {children}
    </header>
  )
}

export function PrintFrame({ children, className = '', tape = true, label }) {
  return (
    <div className={`print-frame ${className}`}>
      {tape ? (
        <>
          <TapeStrip className="print-frame-tape print-frame-tape--tl" angle={-7} />
          <TapeStrip className="print-frame-tape print-frame-tape--tr" angle={6} />
        </>
      ) : null}
      {label ? <span className="print-frame-label">{label}</span> : null}
      <div className="print-frame-mat">{children}</div>
    </div>
  )
}

export function MarkerUnderline({ className = '' }) {
  return <BrushMark className={`marker-underline ${className}`} />
}
