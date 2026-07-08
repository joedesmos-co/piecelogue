import { useEffect, useState } from 'react'
import { resolveSiteRoute } from '../utils/site'

export function useSiteRoute() {
  const [route, setRoute] = useState(() => resolveSiteRoute(window.location.pathname))

  useEffect(() => {
    function handlePopState() {
      setRoute(resolveSiteRoute(window.location.pathname))

      const hash = window.location.hash.slice(1)
      if (hash) {
        requestAnimationFrame(() => {
          document.getElementById(hash)?.scrollIntoView({
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
              ? 'auto'
              : 'smooth',
            block: 'start',
          })
        })
      } else {
        window.scrollTo(0, 0)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return route
}
