import { Plus } from 'lucide-react'
import { APP_NAME } from '../utils/constants'
import { navigate } from '../utils/navigation'
import { BottomNav, Sidebar } from './Navigation'
import SiteFooter from './SiteFooter'
import { BrushMark } from './StudioMarks'

export default function AppShell({ currentPage, onNavigate, onAdd, hideAdd = false, children }) {
  return (
    <div className="app-shell">
      <Sidebar
        currentPage={currentPage}
        onNavigate={onNavigate}
        onAdd={onAdd}
        hideAdd={hideAdd}
      />

      <div className="app-main">
        <header className="mobile-header">
          <button
            type="button"
            className="mobile-header-brand brand-home-link"
            onClick={() => navigate('/')}
            aria-label={`${APP_NAME} home`}
          >
            <span className="brand-wordmark">{APP_NAME}</span>
            <BrushMark className="brand-underline" />
          </button>
          <p className="mobile-header-tagline">
            Your work.
            <br />
            Your story.
          </p>
        </header>

        <main className="app-content">
          <div className="app-page">{children}</div>
          <SiteFooter />
        </main>

        <BottomNav currentPage={currentPage} onNavigate={onNavigate} />

        <button
          type="button"
          className="mobile-add-fab"
          onClick={onAdd}
          aria-label="Add artwork"
        >
          <Plus size={26} strokeWidth={2.5} />
          <span>Add artwork</span>
        </button>
      </div>
    </div>
  )
}
