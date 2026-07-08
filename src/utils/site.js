export const SITE_URL = 'https://piecelogue.com'
export const CONTACT_EMAIL = 'joedesmos.co@gmail.com'

export const ADSENSE_PUBLISHER_ID = 'ca-pub-8017727208750483'
export const ADSENSE_SCRIPT_SRC =
  `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`

export const PUBLIC_ROUTES = {
  ABOUT: '/about',
  PRIVACY: '/privacy',
  TERMS: '/terms',
  CONTACT: '/contact',
}

export const PAGE_SEO = {
  home: {
    path: '/',
    title: 'Piecelogue — Log Your Art, Track Your Journey',
    description:
      'Piecelogue is a local-first app for logging, organizing, viewing, and tracking your creative artwork and progress. Save pieces, use folders, and review lifetime stats in your browser.',
    ogType: 'website',
  },
  about: {
    path: '/about',
    title: 'About Piecelogue',
    description:
      'Learn what Piecelogue is, how it helps artists log artwork and track creative progress, and how your data stays on your device.',
    ogType: 'website',
  },
  privacy: {
    path: '/privacy',
    title: 'Privacy Policy — Piecelogue',
    description:
      'How Piecelogue handles your artwork, local browser storage, hosting, and future advertising-related services.',
    ogType: 'website',
  },
  terms: {
    path: '/terms',
    title: 'Terms of Service — Piecelogue',
    description:
      'Terms for using Piecelogue, including local data responsibility, acceptable use, and service changes.',
    ogType: 'website',
  },
  contact: {
    path: '/contact',
    title: 'Contact — Piecelogue',
    description:
      'Contact Piecelogue for support, privacy questions, and general inquiries.',
    ogType: 'website',
  },
}

export function resolvePublicRoute(pathname) {
  switch (pathname) {
    case PUBLIC_ROUTES.ABOUT:
      return 'about'
    case PUBLIC_ROUTES.PRIVACY:
      return 'privacy'
    case PUBLIC_ROUTES.TERMS:
      return 'terms'
    case PUBLIC_ROUTES.CONTACT:
      return 'contact'
    default:
      return null
  }
}

export function getCanonicalUrl(path) {
  return `${SITE_URL}${path === '/' ? '/' : path}`
}
