import { useEffect } from 'react'
import {
  BarChart3,
  Clock,
  FolderOpen,
  ImagePlus,
  Layers,
  Sparkles,
} from 'lucide-react'
import { APP_ROUTE, PAGE_SEO, PUBLIC_ROUTES } from '../../utils/site'
import { applyPageSeo } from '../../utils/seo'
import { scrollToElement } from '../../utils/navigation'
import HomeStructuredData from '../../components/HomeStructuredData'
import NavLink from '../../components/NavLink'
import SiteFooter from '../../components/SiteFooter'
import LandingHeader from '../../components/landing/LandingHeader'
import ProductPreview from '../../components/landing/ProductPreview'
import '../../styles/landing.css'

const FEATURES = [
  {
    icon: ImagePlus,
    title: 'Log every piece',
    text: 'Save artwork, medium, status, date, notes, and time spent.',
  },
  {
    icon: FolderOpen,
    title: 'Organize your work',
    text: 'Keep artwork arranged in folders without losing sight of unfiled pieces.',
  },
  {
    icon: Clock,
    title: 'Track your time',
    text: 'See how much time you have invested across Digital, Traditional, and Other mediums.',
  },
  {
    icon: BarChart3,
    title: 'See your progress',
    text: 'Build a personal visual history of finished work, works in progress, favorites, and lifetime creative time.',
  },
]

const STEPS = [
  {
    number: '1',
    title: 'Add your artwork',
    text: 'Upload an image and record the details that matter to you.',
  },
  {
    number: '2',
    title: 'Organize and update',
    text: 'Use folders, status, favorites, notes, and editing as your work develops.',
  },
  {
    number: '3',
    title: 'Watch your creative record grow',
    text: 'Piecelogue calculates your artwork totals and creative time automatically.',
  },
]

export default function LandingPage() {
  useEffect(() => {
    applyPageSeo(PAGE_SEO.home)

    const hash = window.location.hash.slice(1)
    if (hash) {
      requestAnimationFrame(() => scrollToElement(hash))
    }
  }, [])

  return (
    <div className="landing-page">
      <HomeStructuredData />
      <LandingHeader />

      <main>
        <section className="landing-hero" aria-labelledby="landing-hero-heading">
          <div className="landing-hero-content landing-animate">
            <p className="landing-eyebrow">
              <Sparkles size={16} aria-hidden="true" />
              A personal record of your creative work
            </p>
            <h1 id="landing-hero-heading" className="landing-hero-title">
              Log your art.
              <br />
              Track your journey.
            </h1>
            <p className="landing-hero-text">
              Piecelogue helps artists save their work, organize pieces into
              folders, record time spent creating, and see their progress grow
              over time.
            </p>
            <div className="landing-hero-actions">
              <NavLink href={APP_ROUTE} className="btn btn--primary landing-hero-cta">
                Open Piecelogue
              </NavLink>
              <NavLink href="#how-it-works" className="btn btn--secondary landing-hero-cta">
                See how it works
              </NavLink>
            </div>
          </div>

          <div className="landing-hero-preview landing-animate landing-animate--delay">
            <ProductPreview />
          </div>
        </section>

        <section
          id="features"
          className="landing-section landing-features"
          aria-labelledby="features-heading"
        >
          <div className="landing-section-header">
            <h2 id="features-heading" className="landing-section-title">
              Everything you need to track your art
            </h2>
            <p className="landing-section-subtitle">
              A focused toolkit for logging, organizing, and reviewing your creative output.
            </p>
          </div>

          <div className="landing-features-grid">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <article key={title} className="landing-feature-card">
                <div className="landing-feature-icon" aria-hidden="true">
                  <Icon size={22} strokeWidth={1.75} />
                </div>
                <h3 className="landing-feature-title">{title}</h3>
                <p className="landing-feature-text">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="how-it-works"
          className="landing-section landing-steps"
          aria-labelledby="how-heading"
        >
          <div className="landing-section-header">
            <h2 id="how-heading" className="landing-section-title">
              How it works
            </h2>
            <p className="landing-section-subtitle">
              Three simple steps to start building your creative record.
            </p>
          </div>

          <ol className="landing-steps-list">
            {STEPS.map(({ number, title, text }) => (
              <li key={number} className="landing-step">
                <span className="landing-step-number" aria-hidden="true">
                  {number}
                </span>
                <div>
                  <h3 className="landing-step-title">{title}</h3>
                  <p className="landing-step-text">{text}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="landing-section-cta">
            <NavLink href={APP_ROUTE} className="btn btn--primary">
              Start logging your art
            </NavLink>
          </div>
        </section>

        <section
          className="landing-section landing-local"
          aria-labelledby="local-heading"
        >
          <div className="landing-local-card">
            <div className="landing-local-icon" aria-hidden="true">
              <Layers size={24} strokeWidth={1.75} />
            </div>
            <h2 id="local-heading" className="landing-local-title">
              Your artwork stays on your device
            </h2>
            <p className="landing-local-text">
              The current version of Piecelogue stores artwork images and metadata
              locally in your browser using IndexedDB. No account is required today,
              and your library does not automatically sync between browsers or devices.
            </p>
            <p className="landing-local-text">
              Clearing browser or site data may remove saved artwork. Before relying
              on Piecelogue as your only copy of a piece, keep backups of important
              images.
            </p>
            <NavLink href={PUBLIC_ROUTES.PRIVACY} className="landing-local-link">
              Read the Privacy Policy
            </NavLink>
          </div>
        </section>

        <section className="landing-section landing-final-cta" aria-labelledby="final-cta-heading">
          <h2 id="final-cta-heading" className="landing-final-title">
            Your art deserves a record
          </h2>
          <p className="landing-final-text">
            Start building a personal history of the pieces you create and the time
            you spend creating them.
          </p>
          <NavLink href={APP_ROUTE} className="btn btn--primary landing-final-btn">
            Open Piecelogue
          </NavLink>
        </section>
      </main>

      <SiteFooter variant="full" />
    </div>
  )
}
