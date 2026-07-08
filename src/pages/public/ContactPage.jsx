import PublicPageLayout from '../../components/PublicPageLayout'
import { APP_NAME } from '../../utils/constants'
import { CONTACT_EMAIL } from '../../utils/site'

export default function ContactPage() {
  return (
    <PublicPageLayout title="Contact">
      <p>
        Have a question about {APP_NAME}, privacy, cloud sync, or how the local-first app works?
        We&apos;d like to hear from you.
      </p>

      <h2>Email</h2>
      <p>
        For support, privacy questions, and general inquiries, contact:
      </p>
      <p>
        <a href={`mailto:${CONTACT_EMAIL}`} className="public-contact-email">
          {CONTACT_EMAIL}
        </a>
      </p>

      <h2>What to include</h2>
      <p>
        Please include enough detail for us to understand your question. If you
        are reporting a problem, mention your browser, device type, and what you
        were trying to do in {APP_NAME}.
      </p>

      <h2>Response time</h2>
      <p>
        We read messages as time allows and aim to respond to legitimate
        inquiries, but response times may vary.
      </p>
    </PublicPageLayout>
  )
}
