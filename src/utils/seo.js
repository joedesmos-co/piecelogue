import { getCanonicalUrl } from './site'

function setMetaTag(attribute, key, content) {
  if (!content) return

  let element = document.head.querySelector(`meta[${attribute}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }
  element.setAttribute('content', content)
}

function setLinkTag(rel, href) {
  if (!href) return

  let element = document.head.querySelector(`link[rel="${rel}"]`)
  if (!element) {
    element = document.createElement('link')
    element.setAttribute('rel', rel)
    document.head.appendChild(element)
  }
  element.setAttribute('href', href)
}

export function applyPageSeo({ title, description, path, ogType = 'website' }) {
  const canonicalUrl = getCanonicalUrl(path)

  document.title = title
  setMetaTag('name', 'description', description)
  setLinkTag('canonical', canonicalUrl)

  setMetaTag('property', 'og:title', title)
  setMetaTag('property', 'og:description', description)
  setMetaTag('property', 'og:url', canonicalUrl)
  setMetaTag('property', 'og:type', ogType)
  setMetaTag('property', 'og:site_name', 'Piecelogue')

  setMetaTag('name', 'twitter:card', 'summary')
  setMetaTag('name', 'twitter:title', title)
  setMetaTag('name', 'twitter:description', description)
}

export function setJsonLd(id, data) {
  let script = document.getElementById(id)
  if (!script) {
    script = document.createElement('script')
    script.id = id
    script.type = 'application/ld+json'
    document.head.appendChild(script)
  }
  script.textContent = JSON.stringify(data)
}

export function removeJsonLd(id) {
  document.getElementById(id)?.remove()
}
