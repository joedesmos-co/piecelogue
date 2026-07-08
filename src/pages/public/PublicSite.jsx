import { useEffect } from 'react'
import { applyPageSeo } from '../../utils/seo'
import { PAGE_SEO } from '../../utils/site'
import AboutPage from './AboutPage'
import PrivacyPage from './PrivacyPage'
import TermsPage from './TermsPage'
import ContactPage from './ContactPage'

const PUBLIC_PAGES = {
  about: AboutPage,
  privacy: PrivacyPage,
  terms: TermsPage,
  contact: ContactPage,
}

export default function PublicSite({ route }) {
  const Page = PUBLIC_PAGES[route]

  useEffect(() => {
    if (PAGE_SEO[route]) {
      applyPageSeo(PAGE_SEO[route])
    }
  }, [route])

  if (!Page) return null

  return <Page />
}
