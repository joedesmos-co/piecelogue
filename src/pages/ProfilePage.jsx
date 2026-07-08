import { useEffect, useState } from 'react'
import {
  BarChart3,
  CheckCircle,
  Clock,
  Folder,
  Monitor,
  Paintbrush,
  Shapes,
} from 'lucide-react'
import AccountSection from '../components/AccountSection'
import CloudRestoreSection from '../components/CloudRestoreSection'
import CloudSaveSection from '../components/CloudSaveSection'
import { useAuth } from '../hooks/useAuth'
import { getStats } from '../db/artworkService'
import { useArtworks } from '../hooks/useArtworks'
import { formatTime } from '../utils/formatTime'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await getStats()
        setStats(data)
      } catch (err) {
        setError(err.message || 'Failed to load statistics.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [artworks])

  return (
    <div className="page profile-page">
      <header className="page-header">
        <h2 className="page-title">Profile</h2>
        <p className="page-subtitle">Your account and creative journey</p>
      </header>

      <AccountSection />

      <CloudRestoreSection authenticated={authenticated} />

      <CloudSaveSection authenticated={authenticated} />

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

        {loading ? (
          <div className="settings-card">
            <p className="settings-text settings-text--muted">Calculating stats...</p>
          </div>
        ) : null}

        {!loading && stats ? (
          <div className="stats-grid">
            <StatCard
              icon={Folder}
              label="Folders"
              value={folders.length}
              accent="primary"
            />
            <StatCard
              icon={BarChart3}
              label="Total artworks"
              value={stats.totalArtworks}
              accent="primary"
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
            <StatCard
              icon={Clock}
              label="Total lifetime time"
              value={formatTime(stats.totalMinutes)}
              accent="time"
            />
            <StatCard
              icon={Monitor}
              label="Digital art time"
              value={formatTime(stats.digitalMinutes)}
              accent="digital"
            />
            <StatCard
              icon={Paintbrush}
              label="Traditional art time"
              value={formatTime(stats.traditionalMinutes)}
              accent="traditional"
            />
            <StatCard
              icon={Shapes}
              label="Other art time"
              value={formatTime(stats.otherMinutes)}
              accent="other"
            />
          </div>
        ) : null}
      </section>
    </div>
  )
}
