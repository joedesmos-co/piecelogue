import { APP_NAME, APP_TAGLINE } from '../utils/constants'
import { APP_ROUTE } from '../utils/site'
import NavLink from './NavLink'
import SiteFooter from './SiteFooter'

export default function PublicPageLayout({ title, children }) {
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

      <main className="public-main">
        <article className="public-page">
          <h1 className="public-page-title">{title}</h1>
          <div className="public-page-content">{children}</div>
        </article>
      </main>

      <SiteFooter variant="full" />
    </div>
  )
}
