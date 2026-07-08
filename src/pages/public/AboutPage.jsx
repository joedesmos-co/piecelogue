import PublicPageLayout from '../../components/PublicPageLayout'
import { APP_NAME } from '../../utils/constants'

export default function AboutPage() {
  return (
    <PublicPageLayout title={`About ${APP_NAME}`}>
      <p>
        {APP_NAME} is a local-first web app for artists who want a simple place to
        log artwork, organize it into folders, and track the time spent creating.
      </p>

      <h2>What you can do today</h2>
      <ul>
        <li>Add artwork with images, titles, medium details, and optional notes</li>
        <li>Organize pieces into folders or leave them unfiled</li>
        <li>Review a gallery of your work on phone or desktop</li>
        <li>Track lifetime statistics such as finished pieces and time spent</li>
        <li>Mark favorites and update status as work progresses</li>
      </ul>

      <h2>Local-first with optional cloud sync</h2>
      <p>
        {APP_NAME} stores your artwork images and metadata locally in your browser using IndexedDB.
        Your creative library stays on the device and browser you use. Refreshing the page keeps
        your saved work, but clearing browser data can remove it — export a backup from Settings for
        extra safety.
      </p>
      <p>
        You can sign in to sync your library to your Piecelogue account. Cloud sync uploads changes
        in the background and lets you restore on another device. During beta, Piecelogue does not
        offer public sharing, payments, subscriptions, ads, or AI features inside the app.
      </p>

      <h2>Built for creative progress</h2>
      <p>
        Whether you work digitally or traditionally, {APP_NAME} is meant to help you
        see your output over time without turning art practice into busywork. The
        focus is on logging, organizing, viewing, and tracking your own journey.
      </p>
    </PublicPageLayout>
  )
}
