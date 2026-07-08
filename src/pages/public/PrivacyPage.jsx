import PublicPageLayout from '../../components/PublicPageLayout'
import { APP_NAME } from '../../utils/constants'
import { CONTACT_EMAIL } from '../../utils/site'

export default function PrivacyPage() {
  return (
    <PublicPageLayout title="Privacy Policy">
      <p>
        This Privacy Policy explains how {APP_NAME} handles information when you
        use the website and web app at piecelogue.com. It describes the current
        local-first version of the service.
      </p>

      <h2>Your artwork stays on your device</h2>
      <p>
        In the current version, artwork images and metadata you add in {APP_NAME}
        are stored locally in your browser using IndexedDB. That data remains on
        your device unless you delete it, clear browser storage, or remove the
        app data from your browser settings.
      </p>
      <p>
        {APP_NAME} does not currently upload your artwork library to cloud
        accounts or provide cross-device synchronization.
      </p>

      <h2>Information processed by hosting providers</h2>
      <p>
        When you visit piecelogue.com, standard web hosting and security
        infrastructure providers such as Cloudflare may process technical
        information needed to deliver the site. This can include IP address,
        browser type, requested pages, timestamps, and similar server or network
        logs used for reliability, security, and abuse prevention.
      </p>

      <h2>Google AdSense preparation</h2>
      <p>
        {APP_NAME} is preparing for Google AdSense review. The site may load the
        official Google AdSense account script for publisher verification and
        future ad serving setup. Visible advertising is not currently active on
        the site.
      </p>
      <p>
        If advertising or analytics features are added later, this policy may be
        updated to describe what data is collected, how it is used, and what
        choices are available to you.
      </p>

      <h2>Consent for advertising</h2>
      <p>
        Before serving personalized ads in regions where consent is legally
        required, {APP_NAME} may need to implement a Google-certified consent
        management platform and appropriate consent handling. The current version
        of the site does not include a consent banner.
      </p>

      <h2>Children&apos;s privacy</h2>
      <p>
        {APP_NAME} is not directed at children under 13, and we do not knowingly
        collect personal information from children.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this Privacy Policy as {APP_NAME} changes. Material updates
        will be reflected on this page.
      </p>

      <h2>Contact</h2>
      <p>
        For privacy questions, contact{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </PublicPageLayout>
  )
}
