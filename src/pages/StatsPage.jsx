import { useEffect, useState } from 'react'
import { BarChart3, CheckCircle, Clock, Monitor, Paintbrush, Shapes } from 'lucide-react'
import { getStats } from '../db/artworkService'
import { formatTime } from '../utils/formatTime'
import { useArtworks } from '../hooks/useArtworks'

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

export default function StatsPage() {
  const { artworks } = useArtworks()
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
    <div className="page stats-page">
      <header className="page-header">
        <h2 className="page-title">Statistics</h2>
        <p className="page-subtitle">Your creative journey at a glance</p>
      </header>

      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-state">Calculating stats...</div>
      ) : (
        <div className="stats-grid">
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
      )}
    </div>
  )
}
