import { Plus } from 'lucide-react'
import { APP_NAME, APP_TAGLINE } from '../utils/constants'
import { navigate } from '../utils/navigation'
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
          <button
            type="button"
            className="mobile-header-brand brand-home-link"
            onClick={() => navigate('/')}
            aria-label={`${APP_NAME} home`}
          >
            <h1 className="mobile-header-title">{APP_NAME}</h1>
            <p className="mobile-header-tagline">{APP_TAGLINE}</p>
          </button>
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
          <div className="app-page">{children}</div>
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
