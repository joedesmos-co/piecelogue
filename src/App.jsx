import { lazy, Suspense } from 'react'
import { useSiteRoute } from './hooks/useSiteRoute'
import LandingPage from './pages/public/LandingPage'
import NotFoundPage from './pages/public/NotFoundPage'
import PublicSite from './pages/public/PublicSite'

const LocalApp = lazy(() => import('./LocalApp.jsx'))

function AppLoading() {
  return (
    <div className="app-loading" role="status" aria-live="polite">
      Loading Piecelogue…
    </div>
  )
}

const PUBLIC_ROUTES = new Set(['about', 'privacy', 'terms', 'contact'])

export default function App() {
  const route = useSiteRoute()

  if (route === 'landing') {
    return <LandingPage />
  }

  if (route === 'app') {
    return (
      <Suspense fallback={<AppLoading />}>
        <LocalApp />
      </Suspense>
    )
  }

  if (PUBLIC_ROUTES.has(route)) {
    return <PublicSite route={route} />
  }

  return <NotFoundPage />
}
