/**
 * Temporary DEV-only panel for diagnosing iPhone / Home Screen cloud auth.
 * Never shows cookies, tokens, emails, or secrets.
 */
import { useEffect, useState } from 'react'
import { fetchMe } from '../api/auth'
import { fetchCloudStatus } from '../api/cloud'
import { useAuth } from '../hooks/useAuth'
import {
  buildCloudRequestSummary,
  getDisplayMode,
  getLastApiRequestDiagnostic,
} from '../utils/apiDiagnostics'

export default function MobileCloudDiagnostics() {
  const { authenticated, loading } = useAuth()
  const [meStatus, setMeStatus] = useState('—')
  const [cloudStatus, setCloudStatus] = useState('—')
  const [lastRequest, setLastRequest] = useState(null)
  const [probeError, setProbeError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function probe() {
      setProbeError('')
      try {
        const me = await fetchMe()
        if (!cancelled) {
          setMeStatus(me.authenticated ? '200 authenticated' : '200 unauthenticated')
        }
      } catch (error) {
        if (!cancelled) {
          setMeStatus(`${error?.status ?? 'err'} ${error?.code || 'failed'}`)
        }
      }

      try {
        await fetchCloudStatus()
        if (!cancelled) {
          setCloudStatus('200 ok')
        }
      } catch (error) {
        if (!cancelled) {
          setCloudStatus(`${error?.status ?? 'err'} ${error?.code || 'failed'}`)
        }
      }

      if (!cancelled) {
        setLastRequest(getLastApiRequestDiagnostic())
      }
    }

    probe().catch((error) => {
      if (!cancelled) {
        setProbeError(error?.message || 'Probe failed')
      }
    })

    const interval = window.setInterval(() => {
      setLastRequest(getLastApiRequestDiagnostic())
    }, 2000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [authenticated, loading])

  const displayMode = getDisplayMode()
  const lastSummary = buildCloudRequestSummary(lastRequest)

  return (
    <section className="settings-section" aria-labelledby="mobile-cloud-diagnostics-heading">
      <h3 id="mobile-cloud-diagnostics-heading" className="settings-section-title">
        Mobile cloud diagnostics (dev)
      </h3>
      <div className="settings-card">
        <p className="settings-text settings-text--muted">
          Temporary development diagnostics. No secrets or cookies are shown.
        </p>
        <ul className="settings-text" style={{ margin: 0, paddingLeft: '1.1rem' }}>
          <li>display mode: {displayMode === 'standalone' ? 'standalone' : 'browser'}</li>
          <li>authenticated: {loading ? 'loading' : authenticated ? 'yes' : 'no'}</li>
          <li>/api/auth/me: {meStatus}</li>
          <li>/api/cloud/status: {cloudStatus}</li>
          <li>last cloud request: {lastSummary}</li>
          <li>last safe error code: {lastRequest?.errorCode || 'none'}</li>
        </ul>
        {probeError ? (
          <div className="alert alert--error" role="alert">
            {probeError}
          </div>
        ) : null}
      </div>
    </section>
  )
}
