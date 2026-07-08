import { Plus } from 'lucide-react'
import { APP_NAME, APP_TAGLINE } from '../utils/constants'
import { BottomNav, Sidebar } from './Navigation'
import SiteFooter from './SiteFooter'

export default function AppShell({
  currentPage,
  onNavigate,
  onAdd,
  children,
}) {
  return (
    <div className="app-shell">
      <Sidebar
        currentPage={currentPage}
        onNavigate={onNavigate}
        onAdd={onAdd}
      />

      <div className="app-main">
        <header className="mobile-header">
          <div className="mobile-header-brand">
            <h1 className="mobile-header-title">{APP_NAME}</h1>
            <p className="mobile-header-tagline">{APP_TAGLINE}</p>
          </div>
          <button
            type="button"
            className="mobile-header-add"
            onClick={onAdd}
            aria-label="Add artwork"
          >
            <Plus size={22} />
          </button>
        </header>

        <main className="app-content">
          {children}
          <SiteFooter />
        </main>

        <BottomNav
          currentPage={currentPage}
          onNavigate={onNavigate}
          onAdd={onAdd}
        />
      </div>
    </div>
  )
}
