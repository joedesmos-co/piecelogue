import { useEffect, useRef, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { APP_NAME } from '../../utils/constants'
import { APP_ROUTE } from '../../utils/site'
import NavLink from '../NavLink'

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '/about', label: 'About' },
]

export default function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const menuButtonRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return undefined

    function handlePointerDown(event) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        !menuButtonRef.current?.contains(event.target)
      ) {
        setMenuOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <header className="landing-header">
      <div className="landing-header-inner">
        <NavLink href="/" className="landing-brand" aria-label={`${APP_NAME} home`}>
          <span className="landing-brand-name">{APP_NAME}</span>
        </NavLink>

        <nav className="landing-nav landing-nav--desktop" aria-label="Primary">
          {NAV_LINKS.map(({ href, label }) => (
            <NavLink key={href} href={href} className="landing-nav-link">
              {label}
            </NavLink>
          ))}
          <NavLink href={APP_ROUTE} className="btn btn--public btn--primary btn--sm landing-nav-cta">
            Open Piecelogue
          </NavLink>
        </nav>

        <div className="landing-nav-mobile">
          <NavLink href={APP_ROUTE} className="btn btn--public btn--primary btn--sm landing-nav-cta-mobile">
            Open
          </NavLink>
          <button
            ref={menuButtonRef}
            type="button"
            className="icon-btn landing-menu-btn"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="landing-mobile-menu"
          ref={menuRef}
          className="landing-mobile-menu"
          aria-label="Primary mobile"
        >
          {NAV_LINKS.map(({ href, label }) => (
            <NavLink
              key={href}
              href={href}
              className="landing-mobile-menu-link"
              onClick={closeMenu}
            >
              {label}
            </NavLink>
          ))}
          <NavLink
            href={APP_ROUTE}
            className="btn btn--public btn--primary landing-mobile-menu-cta"
            onClick={closeMenu}
          >
            Open Piecelogue
          </NavLink>
        </nav>
      )}
    </header>
  )
}
