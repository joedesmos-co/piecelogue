const STORAGE_KEY = 'piecelogue_no_animations'

export function isNoAnimationsPreferenceEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function setNoAnimationsPreferenceEnabled(enabled) {
  try {
    if (enabled) {
      localStorage.setItem(STORAGE_KEY, '1')
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Ignore storage failures.
  }
}

export function shouldReduceMotion() {
  if (isNoAnimationsPreferenceEnabled()) {
    return true
  }
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}