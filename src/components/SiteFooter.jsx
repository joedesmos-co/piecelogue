import { APP_NAME, APP_TAGLINE } from '../utils/constants'
import { APP_ROUTE, PUBLIC_ROUTES } from '../utils/site'
import NavLink from './NavLink'

const FOOTER_LINKS = [
  { href: PUBLIC_ROUTES.ABOUT, label: 'About' },
  { href: PUBLIC_ROUTES.PRIVACY, label: 'Privacy' },
  { href: PUBLIC_ROUTES.TERMS, label: 'Terms' },
  { href: PUBLIC_ROUTES.CONTACT, label: 'Contact' },
]

export default function SiteFooter({ variant = 'compact' }) {
  return (
    <footer className={`site-footer ${variant === 'full' ? 'site-footer--full' : ''}`}>
      {variant === 'full' && (
        <div className="site-footer-brand">
          <NavLink href="/" className="site-footer-brand-name">
            {APP_NAME}
          </NavLink>
          <p className="site-footer-brand-tagline">{APP_TAGLINE}</p>
        </div>
      )}

      <nav className="site-footer-nav" aria-label="Site information">
        {FOOTER_LINKS.map(({ href, label }) => (
          <NavLink key={href} href={href} className="site-footer-link">
            {label}
          </NavLink>
        ))}
        <NavLink href={APP_ROUTE} className="site-footer-link site-footer-link--accent">
          Open App
        </NavLink>
      </nav>

      <p className="site-footer-copy">
        &copy; {new Date().getFullYear()} {APP_NAME}
      </p>
    </footer>
  )
}
