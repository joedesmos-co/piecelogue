import { APP_NAME, APP_TAGLINE } from '../utils/constants'
import SiteFooter from './SiteFooter'

export default function PublicPageLayout({ title, children }) {
  return (
    <div className="public-site">
      <header className="public-header">
        <a href="/" className="public-brand">
          <span className="public-brand-name">{APP_NAME}</span>
          <span className="public-brand-tagline">{APP_TAGLINE}</span>
        </a>
        <a href="/" className="btn btn--secondary btn--sm public-open-app">
          Open App
        </a>
      </header>

      <main className="public-main">
        <article className="public-page">
          <h1 className="public-page-title">{title}</h1>
          <div className="public-page-content">{children}</div>
        </article>
      </main>

      <SiteFooter />
    </div>
  )
}
