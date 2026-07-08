import { navigate, scrollToElement } from '../utils/navigation'

export default function NavLink({
  href,
  children,
  className,
  onClick,
  ...props
}) {
  function handleClick(event) {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return
    }

    if (!href || href.startsWith('mailto:') || href.startsWith('http')) {
      onClick?.(event)
      return
    }

    if (href.startsWith('#')) {
      event.preventDefault()
      const id = href.slice(1)
      if (window.location.pathname === '/') {
        scrollToElement(id)
      } else {
        navigate('/', { hash: id })
      }
      onClick?.(event)
      return
    }

    const [path, hash] = href.split('#')

    if (path.startsWith('/') && !path.startsWith('//')) {
      event.preventDefault()
      navigate(path, hash ? { hash } : {})
    }

    onClick?.(event)
  }

  return (
    <a href={href} className={className} onClick={handleClick} {...props}>
      {children}
    </a>
  )
}
