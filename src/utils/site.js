export const SITE_URL = 'https://piecelogue.com'
export const CONTACT_EMAIL = 'joedesmos.co@gmail.com'

export const ADSENSE_PUBLISHER_ID = 'ca-pub-8017727208750483'
export const ADSENSE_SCRIPT_SRC =
  `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`

export const APP_ROUTE = '/app'

export const PUBLIC_ROUTES = {
  ABOUT: '/about',
  PRIVACY: '/privacy',
  TERMS: '/terms',
  CONTACT: '/contact',
}

export const PAGE_SEO = {
  home: {
    path: '/',
    title: 'Piecelogue — Log Your Art and Track Your Creative Journey',
    description:
      'Piecelogue helps artists log artwork, organize pieces into folders, track time spent creating, and build a personal record of creative progress in the browser.',
    ogType: 'website',
  },
  app: {
    path: '/app',
    title: 'Piecelogue',
    description: 'Open Piecelogue to log artwork and track your creative journey.',
    ogType: 'website',
    robots: 'noindex, nofollow',
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

const PUBLIC_ROUTE_MAP = {
  [PUBLIC_ROUTES.ABOUT]: 'about',
  [PUBLIC_ROUTES.PRIVACY]: 'privacy',
  [PUBLIC_ROUTES.TERMS]: 'terms',
  [PUBLIC_ROUTES.CONTACT]: 'contact',
}

export function resolveSiteRoute(pathname) {
  if (pathname === '/') return 'landing'
  if (pathname === APP_ROUTE) return 'app'
  return PUBLIC_ROUTE_MAP[pathname] ?? 'landing'
}

/** @deprecated Use resolveSiteRoute */
export function resolvePublicRoute(pathname) {
  return PUBLIC_ROUTE_MAP[pathname] ?? null
}

export function getCanonicalUrl(path) {
  return `${SITE_URL}${path === '/' ? '/' : path}`
}
