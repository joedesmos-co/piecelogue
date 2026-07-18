import { useEffect, useState } from 'react'
import {
  BarChart3,
  CheckCircle,
  Clock,
  Folder,
  Monitor,
  Paintbrush,
  Palette,
  Shapes,
} from 'lucide-react'
import AccountSection from '../components/AccountSection'
import CloudSaveSection from '../components/CloudSaveSection'
import AccountDataControlsSection from '../components/AccountDataControlsSection'
import MobileCloudDiagnostics from '../components/MobileCloudDiagnostics'
import { useAuth } from '../hooks/useAuth'
import { getStats } from '../db/artworkService'
import { useArtworks } from '../hooks/useArtworks'
import LoadingState from '../components/LoadingState'
import { formatTime } from '../utils/formatTime'
import { formatUserError } from '../utils/userErrors'
import { wasLibraryClearedOnSignOut } from '../utils/clearLocalLibrary'

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className={`stat-card ${accent ? `stat-card--${accent}` : ''}`}>
      <div className="stat-card-icon" aria-hidden="true">
        <Icon size={22} strokeWidth={1.75} />
      </div>
      <div className="stat-card-content">
        <span className="stat-card-value">{value}</span>
        <span className="stat-card-label">{label}</span>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const { authenticated } = useAuth()
  const { artworks, folders } = useArtworks()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const shouldLoadStats =
    authenticated || (!wasLibraryClearedOnSignOut() && artworks.length > 0)

  useEffect(() => {
    if (!shouldLoadStats) {
      return undefined
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const data = await getStats()
        if (!cancelled) {
          setStats(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(formatUserError(err, 'Failed to load statistics.'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [artworks, shouldLoadStats])

  return (
    <div className="page profile-page">
      <header className="page-header">
        <h2 className="page-title">Profile</h2>
        <p className="page-subtitle">Your account and creative journey</p>
      </header>

      <AccountSection />

      <section className="settings-section">
        <h3 className="settings-section-title">
          <BarChart3 size={18} />
          Lifetime stats
        </h3>

        {error ? (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        ) : null}

        {!shouldLoadStats ? (
          <div className="settings-card settings-card--placeholder profile-stats-empty">
            <div className="empty-state-icon" aria-hidden="true">
              <Palette size={36} strokeWidth={1.5} />
            </div>
            <h4 className="profile-stats-empty-title">Sign in to see your library</h4>
            <p className="settings-text settings-text--muted">
              Lifetime stats appear here when you are signed in or have artwork in your local
              gallery.
            </p>
          </div>
        ) : null}

        {shouldLoadStats && loading ? (
          <LoadingState message="Calculating stats..." />
        ) : null}

        {shouldLoadStats && !loading && stats && stats.totalArtworks === 0 ? (
          <div className="settings-card settings-card--placeholder profile-stats-empty">
            <div className="empty-state-icon" aria-hidden="true">
              <Palette size={36} strokeWidth={1.5} />
            </div>
            <h4 className="profile-stats-empty-title">No stats yet</h4>
            <p className="settings-text settings-text--muted">
              Add artwork from the Gallery to track finished pieces, time spent, and medium breakdowns
              here.
            </p>
          </div>
        ) : null}

        {shouldLoadStats && !loading && stats && stats.totalArtworks > 0 ? (
          <div className="stats-grid">
            <StatCard
              icon={Clock}
              label="Total lifetime time"
              value={formatTime(stats.totalMinutes)}
              accent="time"
            />
            <StatCard
              icon={BarChart3}
              label="Total artworks"
              value={stats.totalArtworks}
              accent="primary"
            />
            <StatCard
              icon={Folder}
              label="Total folders"
              value={folders.length}
              accent="primary"
            />
            <StatCard
              icon={Paintbrush}
              label="Traditional art time"
              value={formatTime(stats.traditionalMinutes)}
              accent="traditional"
            />
            <StatCard
              icon={Monitor}
              label="Digital art time"
              value={formatTime(stats.digitalMinutes)}
              accent="digital"
            />
            <StatCard
              icon={Shapes}
              label="Other art time"
              value={formatTime(stats.otherMinutes)}
              accent="other"
            />
            <StatCard
              icon={CheckCircle}
              label="Finished"
              value={stats.finished}
              accent="success"
            />
            <StatCard
              icon={Clock}
              label="In progress"
              value={stats.inProgress}
              accent="warning"
            />
          </div>
        ) : null}
      </section>

      <CloudSaveSection authenticated={authenticated} />

      <AccountDataControlsSection authenticated={authenticated} />

      {import.meta.env.DEV ? <MobileCloudDiagnostics /> : null}
    </div>
  )
}
