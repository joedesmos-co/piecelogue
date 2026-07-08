import { useState } from 'react'
import { Cloud, LogOut, User } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import SignInDialog from './SignInDialog'

export default function AccountSection() {
  const { authenticated, user, loading, error, signOut } = useAuth()
  const [showDevSignIn, setShowDevSignIn] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')

  async function handleSignOut() {
    setSignOutError('')
    setSigningOut(true)

    try {
      await signOut()
    } catch (err) {
      setSignOutError(err.message || 'Unable to sign out. Please try again.')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <>
      <section className="settings-section">
        <h3 className="settings-section-title">
          <User size={18} />
          Account
        </h3>

        <div className="settings-card">
          {loading ? (
            <p className="settings-text settings-text--muted">Loading account...</p>
          ) : null}

          {!loading && error ? (
            <div className="alert alert--error" role="alert">
              {error}
            </div>
          ) : null}

          {!loading && !error && authenticated ? (
            <div className="account-signed-in">
              <p className="settings-text">
                Signed in as <span className="account-email">{user?.email}</span>
              </p>
              <div className="account-actions">
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={handleSignOut}
                  disabled={signingOut}
                >
                  <LogOut size={16} aria-hidden="true" />
                  {signingOut ? 'Signing out...' : 'Sign out'}
                </button>
              </div>
              {signOutError ? (
                <div className="form-error" role="alert">
                  {signOutError}
                </div>
              ) : null}
            </div>
          ) : null}

          {!loading && !error && !authenticated ? (
            <div className="account-signed-out">
              <p className="settings-text settings-text--muted">
                Sign in to link your account. Cloud sync is not available yet.
              </p>
              <div className="account-sign-in-options">
                <a href="/api/auth/google/start" className="btn btn--primary account-google-btn">
                  Continue with Google
                </a>
                {import.meta.env.DEV ? (
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => setShowDevSignIn(true)}
                  >
                    Development email login
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">
          <Cloud size={18} />
          Cloud Sync
        </h3>
        <div className="settings-card settings-card--placeholder">
          <p className="settings-text settings-text--muted">Cloud Sync: Not enabled yet</p>
        </div>
      </section>

      <SignInDialog isOpen={showDevSignIn} onClose={() => setShowDevSignIn(false)} />
    </>
  )
}
