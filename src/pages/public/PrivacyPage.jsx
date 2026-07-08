import PublicPageLayout from '../../components/PublicPageLayout'
import { APP_NAME } from '../../utils/constants'
import { CONTACT_EMAIL } from '../../utils/site'

export default function PrivacyPage() {
  return (
    <PublicPageLayout title="Privacy Policy">
      <p>
        This Privacy Policy explains how {APP_NAME} handles information when you use the website
        and web app at piecelogue.com, including the local-first app at /app.
      </p>

      <h2>Local storage on your device</h2>
      <p>
        {APP_NAME} stores your artwork images and metadata locally in your browser using IndexedDB.
        This local library remains on your device unless you delete it, clear browser storage, or
        remove site data from your browser settings.
      </p>
      <p>
        You can export a JSON backup from Settings inside the app. Backups stay on your device
        unless you choose to store them elsewhere.
      </p>

      <h2>Account and cloud backup (optional)</h2>
      <p>
        If you choose to sign in, {APP_NAME} creates an account using your email address and an
        optional username. We store account and session records in our database so you can sign in
        across visits.
      </p>
      <p>
        When signed in, {APP_NAME} can back up your folders, artwork metadata, and images to cloud
        storage tied to your account. Cloud backup is private to your account — it is not a public
        portfolio or sharing feature.
      </p>
      <p>Cloud backup may include:</p>
      <ul>
        <li>Email address and username</li>
        <li>Folder names and structure</li>
        <li>Artwork titles, medium details, status, notes, time logged, and dates</li>
        <li>Artwork image files you upload for backup</li>
        <li>Sync metadata such as revision timestamps</li>
      </ul>

      <h2>What we do not do in the app</h2>
      <p>
        The {APP_NAME} app does not include public sharing, payments, subscriptions, in-app
        advertising, or AI features. Your library is for your personal use.
      </p>

      <h2>Hosting and security logs</h2>
      <p>
        When you visit piecelogue.com, infrastructure providers such as Cloudflare may process
        technical information needed to deliver the site. This can include IP address, browser
        type, requested pages, timestamps, and similar server or network logs used for reliability,
        security, and abuse prevention.
      </p>
      <p>
        Authentication uses HttpOnly session cookies. Sign-in links and OAuth flows use short-lived
        tokens that are stored hashed on the server and are not exposed in API responses.
      </p>

      <h2>Deleting your data</h2>
      <p>
        Inside the app, you can delete all cloud data or delete your entire account from Profile.
        Deleting your account removes your cloud library, sessions, and account record. Local data on
        a device is not removed automatically unless you delete it in the app or clear browser
        storage.
      </p>

      <h2>Children&apos;s privacy</h2>
      <p>
        {APP_NAME} is not directed at children under 13, and we do not knowingly collect personal
        information from children.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this Privacy Policy as {APP_NAME} changes. Material updates will be reflected
        on this page.
      </p>

      <h2>Contact</h2>
      <p>
        For privacy questions, contact{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </PublicPageLayout>
  )
}
