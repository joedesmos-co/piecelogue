export default function GalleryBreadcrumbs({ crumbs, onNavigate }) {
  if (!crumbs.length) {
    return null
  }

  return (
    <nav className="gallery-breadcrumbs" aria-label="Folder path">
      <button type="button" className="gallery-breadcrumb-link" onClick={() => onNavigate(-1)}>
        Gallery
      </button>
      {crumbs.map((crumb, index) => (
        <span key={crumb.id} className="gallery-breadcrumb-item">
          <span className="gallery-breadcrumb-separator" aria-hidden="true">
            &gt;
          </span>
          {index === crumbs.length - 1 ? (
            <span className="gallery-breadcrumb-current" aria-current="page">
              {crumb.name}
            </span>
          ) : (
            <button
              type="button"
              className="gallery-breadcrumb-link"
              onClick={() => onNavigate(index)}
            >
              {crumb.name}
            </button>
          )}
        </span>
      ))}
    </nav>
  )
}
