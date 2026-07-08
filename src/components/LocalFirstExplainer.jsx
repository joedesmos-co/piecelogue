import { Cloud, HardDrive, Shield } from 'lucide-react'

export default function LocalFirstExplainer({ compact = false }) {
  return (
    <div className={`local-first-explainer ${compact ? 'local-first-explainer--compact' : ''}`}>
      <div className="local-first-point">
        <HardDrive size={18} aria-hidden="true" />
        <p className="settings-text">
          <strong>Local-first.</strong> Artwork and images are stored in this browser on your device.
        </p>
      </div>
      <div className="local-first-point">
        <Cloud size={18} aria-hidden="true" />
        <p className="settings-text">
          <strong>Cloud sync.</strong> When signed in, changes upload in the background and can be
          restored on another device.
        </p>
      </div>
      <div className="local-first-point">
        <Shield size={18} aria-hidden="true" />
        <p className="settings-text settings-text--muted">
          Beta focus: your private library only — no public sharing, payments, subscriptions, ads, or
          AI features inside the app.
        </p>
      </div>
    </div>
  )
}
