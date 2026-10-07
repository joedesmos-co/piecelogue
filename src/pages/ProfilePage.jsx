import { useEffect, useState } from 'react'
import {
  BarChart3,
  CheckCircle,
  Clock,
  Folder,
  Palette,
  Star,
} from 'lucide-react'
import AccountSection from '../components/AccountSection'
import CloudSaveSection from '../components/CloudSaveSection'
import AccountDataControlsSection from '../components/AccountDataControlsSection'
import MobileCloudDiagnostics from '../components/MobileCloudDiagnostics'
import { useAuth } from '../hooks/useAuth'
import { getStats } from '../db/artworkService'
import { useArtworks } from '../hooks/useArtworks'
import LoadingState from '../components/LoadingState'
import { StudioHeading } from '../components/StudioKit'
import { formatTime } from '../utils/formatTime'
import { formatUserError } from '../utils/userErrors'
import { wasLibraryClearedOnSignOut } from '../utils/clearLocalLibrary'

function LogbookCell({ icon: Icon, label, value, tone = '' }) {
  return (
    <div className={`logbook-cell ${tone ? `logbook-cell--${tone}` : ''}`}>
      <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
      <span className="logbook-cell-value">{value}</span>
      <span className="logbook-cell-label">{label}</span>
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

  const favoriteCount = artworks.filter((artwork) => artwork.favorite).length
  const mediumTotal = stats
    ? stats.traditionalMinutes + stats.digitalMinutes + stats.otherMinutes
    : 0
  const heroHours = stats ? Math.floor(stats.totalMinutes / 60) : 0
  const heroMinutes = stats ? stats.totalMinutes % 60 : 0
  const heroNumber = heroHours > 0 ? heroHours : heroMinutes
  const heroUnit = heroHours > 0 ? 'hours' : 'minutes'

  return (
    <div className="page profile-page">
      <StudioHeading
        kicker="Piecelogue"
        title="My Studio"
        note="A record of the work I make."
      />

      <AccountSection />

      <section className="settings-section" aria-labelledby="logbook-heading">
        <h3 id="logbook-heading" className="settings-section-title">
          <BarChart3 size={18} aria-hidden="true" />
          Studio logbook
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
              Add artwork from the Gallery to track finished pieces, time spent, and medium
              breakdowns here.
            </p>
          </div>
        ) : null}

        {shouldLoadStats && !loading && stats && stats.totalArtworks > 0 ? (
          <div className="logbook">
            <div className="logbook-hero studio-panel">
              <p className="logbook-hero-kicker">Lifetime time in the studio</p>
              <span className="logbook-hero-number">{heroNumber}</span>
              <div className="logbook-hero-foot">
                <span className="logbook-hero-label">
                  {heroUnit} · {formatTime(stats.totalMinutes)} logged
                </span>
                <span className="logbook-hero-note">keep going.</span>
              </div>
              {stats.unknownCount > 0 ? (
                <p
                  className="logbook-hero-sub"
                  style={{
                    margin: '10px 0 0',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--paper-text-muted)',
                  }}
                >
                  Based on {stats.trackedCount} artwork{stats.trackedCount !== 1 ? 's' : ''} with
                  time tracked
                  {stats.unknownCount === 1
                    ? ' · 1 without time'
                    : ` · ${stats.unknownCount} without time`}
                </p>
              ) : null}
            </div>

            <div className="logbook-grid">
              <LogbookCell
                icon={CheckCircle}
                label="Finished"
                value={stats.finished}
              />
              <LogbookCell
                icon={Clock}
                label="In progress"
                value={stats.inProgress}
              />
              <LogbookCell
                icon={Folder}
                label="Folders"
                value={folders.length}
              />
              <LogbookCell
                icon={Star}
                label="Favorites"
                value={favoriteCount}
                tone="cobalt"
              />
            </div>

            <div className="logbook-split">
              <h4 className="logbook-split-title">Time by medium</h4>
              {[
                {
                  key: 'traditional',
                  name: 'Traditional',
                  minutes: stats.traditionalMinutes,
                },
                { key: 'digital', name: 'Digital', minutes: stats.digitalMinutes },
                { key: 'other', name: 'Other', minutes: stats.otherMinutes },
              ].map((row) => (
                <div key={row.key} className={`logbook-bar-row logbook-bar-row--${row.key}`}>
                  <span className="logbook-bar-name">{row.name}</span>
                  <span className="logbook-bar-track">
                    <span
                      className="logbook-bar-fill"
                      style={{
                        width: mediumTotal > 0 ? `${(row.minutes / mediumTotal) * 100}%` : '0%',
                      }}
                    />
                  </span>
                  <span className="logbook-bar-value">
                    {row.minutes > 0 ? formatTime(row.minutes) : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <CloudSaveSection authenticated={authenticated} />

      <AccountDataControlsSection authenticated={authenticated} />

      {import.meta.env.DEV ? <MobileCloudDiagnostics /> : null}
    </div>
  )
}
