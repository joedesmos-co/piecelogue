import PublicPageLayout from '../../components/PublicPageLayout'
import { APP_NAME } from '../../utils/constants'
import { CONTACT_EMAIL } from '../../utils/site'

export default function TermsPage() {
  return (
    <PublicPageLayout title="Terms of Service">
      <p>
        These Terms of Service govern your use of {APP_NAME} at piecelogue.com.
        By using the site or app, you agree to these terms.
      </p>

      <h2>The service</h2>
      <p>
        {APP_NAME} provides a browser-based tool for logging, organizing,
        viewing, and tracking creative artwork and related progress information.
        The current version stores data locally in your browser.
      </p>

      <h2>Provided as-is</h2>
      <p>
        {APP_NAME} is provided on an &ldquo;as is&rdquo; and &ldquo;as
        available&rdquo; basis without warranties of any kind, whether express or
        implied. We do not guarantee uninterrupted access, error-free operation,
        or permanent storage of your data.
      </p>

      <h2>Your artwork and content</h2>
      <p>
        You retain ownership of the artwork, images, and content you add to
        {APP_NAME}. You are responsible for ensuring you have the rights to
        upload and store the material you add.
      </p>

      <h2>Your responsibility for backups</h2>
      <p>
        Because the current version stores data locally in your browser, you are
        responsible for maintaining backups of important artwork and records.
        Clearing browser data, using private browsing, changing devices, or
        reinstalling your browser may remove your saved library.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to misuse {APP_NAME}, including by:</p>
      <ul>
        <li>Attempting to disrupt, damage, or overload the service</li>
        <li>Using the site to distribute unlawful, harmful, or infringing content</li>
        <li>Attempting unauthorized access to systems or data</li>
        <li>Reverse engineering or interfering with normal site operation</li>
      </ul>

      <h2>Changes to the service</h2>
      <p>
        {APP_NAME} may change, suspend, or discontinue features over time,
        including adding or removing functionality such as export, sync,
        advertising, or account features. Continued use after changes means you
        accept the updated service.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, {APP_NAME} and its operator will
        not be liable for any loss of data, artwork, profits, or indirect damages
        arising from your use of the service.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms can be sent to{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </PublicPageLayout>
  )
}
