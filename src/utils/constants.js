export const APP_NAME = 'Piecelogue'
export const APP_TAGLINE = 'Log your art. Track your journey.'
export const APP_VERSION = '0.1.0'

export const MEDIUM_TYPES = ['Traditional', 'Digital', 'Other']

export const MEDIUM_SUGGESTIONS = [
  'Pencil',
  'Colored Pencil',
  'Marker',
  'Pen and Ink',
  'Watercolor',
  'Acrylic',
  'Oil Paint',
  'Charcoal',
  'Pastel',
  'Procreate',
  'Photoshop',
  'Illustrator',
  'Clip Studio Paint',
  'Blender',
  'Photography',
  'Mixed Media',
]

export const STATUSES = ['In Progress', 'Finished']

export const PAGES = {
  GALLERY: 'gallery',
  STATS: 'stats',
  SETTINGS: 'settings',
}

export const GALLERY_VIEWS = {
  HOME: 'home',
  ALL: 'all',
  FOLDER: 'folder',
  UNFILED: 'unfiled',
}

export function resolveMediumType(artwork) {
  if (artwork?.mediumType && MEDIUM_TYPES.includes(artwork.mediumType)) {
    return artwork.mediumType
  }
  if (artwork?.type === 'Digital') return 'Digital'
  if (artwork?.type === 'Traditional') return 'Traditional'
  return 'Other'
}
