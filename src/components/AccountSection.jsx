import { useEffect, useState } from 'react'
import { Cloud, LogOut, User } from 'lucide-react'
import { fetchProfile, updateUsername } from '../api/profile'
import { useAuth } from '../hooks/useAuth'
import SignInDialog from './SignInDialog'
import UsernameDialog from './UsernameDialog'

const GOOGLE_SIGN_IN_URL = '/api/auth/google/start'

function startGoogleSignIn() {
  window.location.href = GOOGLE_SIGN_IN_URL
}

function formatHandle(username) {
  if (!username) return null
  return username.startsWith('@') ? username : `@${username}`
}

export default function AccountSection() {
  const { authenticated, user, loading, error, signOut } = useAuth()
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [showEmailSignIn, setShowEmailSignIn] = useState(false)
  const [showUsernameDialog, setShowUsernameDialog] = useState(false)
  const [savingUsername, setSavingUsername] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')

  useEffect(() => {
    if (!authenticated) {
      return
    }

    let cancelled = false

    async function loadProfile() {
      setProfileLoading(true)
      setProfileError('')

      try {
        const result = await fetchProfile()
        if (!cancelled) {
          setProfile(result.profile)
        }
      } catch (err) {
        if (!cancelled) {
          setProfileError(err.message || 'Failed to load profile.')
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false)
        }
      }
    }

    loadProfile()
    return () => {
      cancelled = true
    }
  }, [authenticated, user?.id])

  async function handleSignOut() {
    setSignOutError('')
    setSigningOut(true)

    try {
      await signOut()
      setProfile(null)
    } catch (err) {
      setSignOutError(err.message || 'Unable to sign out. Please try again.')
    } finally {
      setSigningOut(false)
    }
  }

  async function handleSaveUsername(username) {
    setSavingUsername(true)

    try {
      const result = await updateUsername(username)
      setProfile(result.profile)
    } finally {
      setSavingUsername(false)
    }
  }

  const email = authenticated ? (profile?.email ?? user?.email) : null
  const username = authenticated ? (profile?.username ?? null) : null
  const usernameDialogTitle = username ? 'Edit username' : 'Choose username'

  return (
    <>
      <section className="settings-section">
        <h3 className="settings-section-title">
          <User size={18} />
          Account
        </h3>

        <div className="settings-card">
          {loading || (authenticated && profileLoading) ? (
            <p className="settings-text settings-text--muted">Loading account...</p>
          ) : null}

          {!loading && error ? (
            <div className="alert alert--error" role="alert">
              {error}
            </div>
          ) : null}

          {!loading && authenticated && profileError ? (
            <div className="alert alert--error" role="alert">
              {profileError}
            </div>
          ) : null}

          {!loading && !error && authenticated && !profileLoading ? (
            <div className="account-signed-in">
              <div className="account-profile-fields">
                <p className="settings-text">
                  Email <span className="account-email">{email}</span>
                </p>
                <div className="account-username-row">
                  <p className="settings-text">
                    Username{' '}
                    {username ? (
                      <span className="account-username">{formatHandle(username)}</span>
                    ) : (
                      <span className="settings-text--muted">Not set yet</span>
                    )}
                  </p>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => setShowUsernameDialog(true)}
                  >
                    {username ? 'Edit' : 'Choose username'}
                  </button>
                </div>
              </div>
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
                Sign in to reserve a username for future sharing. Cloud sync is not available yet.
              </p>
              <div className="account-sign-in-options">
                <button
                  type="button"
                  className="btn btn--primary account-google-btn"
                  onClick={startGoogleSignIn}
                >
                  Continue with Google
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => setShowEmailSignIn(true)}
                >
                  Use email instead
                </button>
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

      <SignInDialog isOpen={showEmailSignIn} onClose={() => setShowEmailSignIn(false)} />
      <UsernameDialog
        isOpen={showUsernameDialog}
        onClose={() => setShowUsernameDialog(false)}
        onSubmit={handleSaveUsername}
        initialUsername={username ?? ''}
        title={usernameDialogTitle}
        saving={savingUsername}
      />
    </>
  )
}
