import { useEffect, useState } from 'react'
import { resolvePublicRoute } from '../utils/site'

export function usePublicRoute() {
  const [route, setRoute] = useState(() => resolvePublicRoute(window.location.pathname))

  useEffect(() => {
    function handlePopState() {
      setRoute(resolvePublicRoute(window.location.pathname))
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return route
}
