export const SESSION_COOKIE_NAME = '__Host-piecelogue_session'
export const SESSION_COOKIE_NAME_DEV = 'piecelogue_session_dev'

export const OAUTH_STATE_COOKIE_NAME = '__Host-piecelogue_oauth_state'
export const OAUTH_STATE_COOKIE_NAME_DEV = 'piecelogue_oauth_state_dev'
export const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60

export const MAGIC_LINK_TTL_MS = 15 * 60 * 1000
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const SESSION_MAX_AGE_SECONDS = Math.floor(SESSION_TTL_MS / 1000)

export const TOKEN_BYTE_LENGTH = 32
export const MAX_JSON_BODY_BYTES = 4096

/** Minimum interval between magic-link requests for the same email. */
export const REQUEST_LINK_COOLDOWN_MS = 60 * 1000

export const AUTH_CACHE_HEADERS = {
  'Cache-Control': 'no-store',
}

export const VERIFY_REDIRECT_HEADERS = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
}
