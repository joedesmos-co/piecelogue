import { useEffect } from 'react'
import { APP_NAME, APP_TAGLINE } from '../../utils/constants'
import { APP_ROUTE, PAGE_SEO } from '../../utils/site'
import { applyPageSeo } from '../../utils/seo'
import NavLink from '../../components/NavLink'
import SiteFooter from '../../components/SiteFooter'

export default function NotFoundPage() {
  useEffect(() => {
    applyPageSeo({
      ...PAGE_SEO.notFound,
      path: window.location.pathname,
    })
  }, [])

  return (
    <div className="public-site">
      <header className="public-header">
        <NavLink href="/" className="public-brand" aria-label={`${APP_NAME} home`}>
          <span className="public-brand-name">{APP_NAME}</span>
          <span className="public-brand-tagline">{APP_TAGLINE}</span>
        </NavLink>
        <NavLink href={APP_ROUTE} className="btn btn--public btn--secondary btn--sm public-open-app">
          Open App
        </NavLink>
      </header>

      <main className="public-main not-found-main">
        <article className="public-page not-found-page">
          <p className="not-found-code" aria-hidden="true">
            404
          </p>
          <h1 className="public-page-title">Page not found</h1>
          <p className="not-found-text">
            The page you requested does not exist or may have moved. You can
            return to the homepage or open Piecelogue to continue logging your
            art.
          </p>
          <div className="not-found-actions">
            <NavLink href="/" className="btn btn--public btn--primary">
              Go to homepage
            </NavLink>
            <NavLink href={APP_ROUTE} className="btn btn--public btn--secondary">
              Open Piecelogue
            </NavLink>
          </div>
        </article>
      </main>

      <SiteFooter variant="full" />
    </div>
  )
}
