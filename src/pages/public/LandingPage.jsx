import { useEffect } from 'react'
import { APP_ROUTE, PAGE_SEO, PUBLIC_ROUTES } from '../../utils/site'
import { applyPageSeo } from '../../utils/seo'
import { scrollToElement } from '../../utils/navigation'
import HomeStructuredData from '../../components/HomeStructuredData'
import NavLink from '../../components/NavLink'
import SiteFooter from '../../components/SiteFooter'
import { TapeStrip } from '../../components/StudioKit'
import LandingHeader from '../../components/landing/LandingHeader'
import ProductPreview from '../../components/landing/ProductPreview'
import '../../styles/landing.css'

const FEATURES = [
  {
    title: 'Log every piece',
    text: 'Save artwork, medium, status, date, notes, and time spent.',
  },
  {
    title: 'Keep the images',
    text: 'Your images live with the record, ready to open and revisit.',
  },
  {
    title: 'Organize your work',
    text: 'Arrange artwork in folders without losing sight of unfiled pieces.',
  },
  {
    title: 'Track your time',
    text: 'See the hours invested across Digital, Traditional, and Other mediums.',
  },
  {
    title: 'Review your history',
    text: 'A personal visual history of finished work, works in progress, and favorites.',
  },
  {
    title: 'Sync when you want',
    text: 'Local-first by default, with optional private cloud backup across devices.',
  },
]

const STEPS = [
  {
    number: '01',
    title: 'Add your artwork',
    text: 'Upload an image and record the details that matter to you.',
  },
  {
    number: '02',
    title: 'Organize and update',
    text: 'Use folders, status, favorites, notes, and editing as your work develops.',
  },
  {
    number: '03',
    title: 'Watch your record grow',
    text: 'Piecelogue totals your artwork and creative time automatically.',
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
        <section className="zine-hero" aria-labelledby="landing-hero-heading">
          <div className="zine-hero-copy landing-animate">
            <p className="zine-eyebrow">A personal record of your creative work</p>
            <h1 id="landing-hero-heading" className="zine-hero-title">
              Your art
              <br />
              deserves
              <br />
              <span className="zine-hero-title-accent">a record.</span>
            </h1>
            <p className="zine-hero-sub">
              Piecelogue helps artists save their work, organize pieces into folders,
              record time spent creating, and see their progress grow over time.
            </p>
            <div className="zine-hero-actions">
              <NavLink href={APP_ROUTE} className="btn btn--action zine-cta">
                Open Piecelogue
              </NavLink>
              <NavLink href="#how-it-works" className="btn btn--secondary zine-cta">
                See how it works
              </NavLink>
            </div>
            <ul className="zine-hero-points">
              <li>Log artwork</li>
              <li>Keep images</li>
              <li>Organize folders</li>
              <li>Track time</li>
              <li>Local-first</li>
              <li>Optional sync</li>
            </ul>
          </div>

          <div className="zine-hero-art landing-animate landing-animate--delay">
            <ProductPreview />
          </div>
        </section>

        <section id="features" className="zine-section zine-features" aria-labelledby="features-heading">
          <header className="zine-section-head">
            <p className="zine-kicker">Everything you need</p>
            <h2 id="features-heading" className="zine-title">
              A studio record, not a to-do list.
            </h2>
          </header>

          <div className="zine-feature-list">
            {FEATURES.map((feature, index) => (
              <article key={feature.title} className="zine-feature">
                <span className="zine-feature-index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="zine-feature-title">{feature.title}</h3>
                  <p className="zine-feature-text">{feature.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="zine-section zine-steps" aria-labelledby="how-heading">
          <header className="zine-section-head">
            <p className="zine-kicker">How it works</p>
            <h2 id="how-heading" className="zine-title">
              Three steps to a creative record.
            </h2>
          </header>

          <ol className="zine-step-list">
            {STEPS.map((step) => (
              <li key={step.number} className="zine-step">
                <span className="zine-step-number" aria-hidden="true">
                  {step.number}
                </span>
                <h3 className="zine-step-title">{step.title}</h3>
                <p className="zine-step-text">{step.text}</p>
              </li>
            ))}
          </ol>

          <div className="zine-section-cta">
            <NavLink href={APP_ROUTE} className="btn btn--action zine-cta">
              Start logging your art
            </NavLink>
          </div>
        </section>

        <section className="zine-section zine-local" aria-labelledby="local-heading">
          <div className="zine-local-sheet studio-panel">
            <TapeStrip angle={-5} />
            <p className="zine-kicker zine-kicker--dark">Local-first</p>
            <h2 id="local-heading" className="zine-local-title">
              Your artwork stays on your device.
            </h2>
            <p className="zine-local-text">
              The current version of Piecelogue stores artwork images and metadata locally in
              your browser using IndexedDB. No account is required today, and your library does
              not automatically sync between browsers or devices.
            </p>
            <p className="zine-local-text">
              Clearing browser or site data may remove saved artwork. Before relying on
              Piecelogue as your only copy of a piece, keep backups of important images.
            </p>
            <NavLink href={PUBLIC_ROUTES.PRIVACY} className="zine-local-link">
              Read the Privacy Policy →
            </NavLink>
          </div>
        </section>

        <section className="zine-final" aria-labelledby="final-cta-heading">
          <p className="zine-kicker">Start today</p>
          <h2 id="final-cta-heading" className="zine-final-title">
            Your art deserves a record.
          </h2>
          <p className="zine-final-text">
            Start building a personal history of the pieces you create and the time you spend
            creating them.
          </p>
          <NavLink href={APP_ROUTE} className="btn btn--action zine-cta zine-final-btn">
            Open Piecelogue
          </NavLink>
        </section>
      </main>

      <SiteFooter variant="full" />
    </div>
  )
}
