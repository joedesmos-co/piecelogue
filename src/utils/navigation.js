function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function scrollToElement(id) {
  const element = document.getElementById(id)
  if (!element) return

  element.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'start',
  })
}

/**
 * Client-side navigation for same-origin paths. Dispatches popstate so route
 * hooks update without a full page reload.
 */
export function navigate(path, { replace = false, hash = null } = {}) {
  const targetPath = path.split('#')[0] || '/'
  const targetHash = hash ?? (path.includes('#') ? path.split('#')[1] : null)
  const currentPath = window.location.pathname

  if (currentPath === targetPath && !targetHash) {
    window.scrollTo(0, 0)
    return
  }

  const url = targetHash ? `${targetPath}#${targetHash}` : targetPath

  if (replace) {
    window.history.replaceState(null, '', url)
  } else {
    window.history.pushState(null, '', url)
  }

  window.dispatchEvent(new PopStateEvent('popstate'))

  if (targetHash) {
    requestAnimationFrame(() => scrollToElement(targetHash))
  } else {
    window.scrollTo(0, 0)
  }
}
