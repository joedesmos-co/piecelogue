import { Images, User, Settings, Plus } from 'lucide-react'
import { APP_NAME, PAGES } from '../utils/constants'

const NAV_ITEMS = [
  { id: PAGES.GALLERY, label: 'Gallery', icon: Images },
  { id: PAGES.PROFILE, label: 'Profile', icon: User },
  { id: PAGES.SETTINGS, label: 'Settings', icon: Settings },
]

export function BottomNav({ currentPage, onNavigate, onAdd }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={`bottom-nav-item ${currentPage === id ? 'bottom-nav-item--active' : ''}`}
          onClick={() => onNavigate(id)}
          aria-current={currentPage === id ? 'page' : undefined}
        >
          <Icon size={22} strokeWidth={currentPage === id ? 2.25 : 1.75} />
          <span>{label}</span>
        </button>
      ))}
      <button
        type="button"
        className="bottom-nav-add"
        onClick={onAdd}
        aria-label="Add artwork"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>
    </nav>
  )
}

export function Sidebar({ currentPage, onNavigate, onAdd }) {
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="sidebar-brand">
        <span className="sidebar-logo">{APP_NAME}</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`sidebar-nav-item ${currentPage === id ? 'sidebar-nav-item--active' : ''}`}
            onClick={() => onNavigate(id)}
            aria-current={currentPage === id ? 'page' : undefined}
          >
            <Icon size={20} strokeWidth={currentPage === id ? 2.25 : 1.75} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <button type="button" className="sidebar-add btn btn--primary" onClick={onAdd}>
        <Plus size={18} />
        Add Artwork
      </button>
    </aside>
  )
}
