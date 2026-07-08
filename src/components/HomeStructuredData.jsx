import { useEffect } from 'react'
import { APP_NAME, APP_TAGLINE } from '../utils/constants'
import { SITE_URL } from '../utils/site'
import { removeJsonLd, setJsonLd } from '../utils/seo'

const JSON_LD_ID = 'piecelogue-software-application'

export default function HomeStructuredData() {
  useEffect(() => {
    setJsonLd(JSON_LD_ID, {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: APP_NAME,
      description: APP_TAGLINE,
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Web',
      url: SITE_URL,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    })

    return () => removeJsonLd(JSON_LD_ID)
  }, [])

  return null
}
