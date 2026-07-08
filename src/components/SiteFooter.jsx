import { PUBLIC_ROUTES } from '../utils/site'

const FOOTER_LINKS = [
  { href: PUBLIC_ROUTES.ABOUT, label: 'About' },
  { href: PUBLIC_ROUTES.PRIVACY, label: 'Privacy' },
  { href: PUBLIC_ROUTES.TERMS, label: 'Terms' },
  { href: PUBLIC_ROUTES.CONTACT, label: 'Contact' },
]

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav className="site-footer-nav" aria-label="Site information">
        {FOOTER_LINKS.map(({ href, label }) => (
          <a key={href} href={href} className="site-footer-link">
            {label}
          </a>
        ))}
      </nav>
      <p className="site-footer-copy">
        &copy; {new Date().getFullYear()} Piecelogue
      </p>
    </footer>
  )
}
