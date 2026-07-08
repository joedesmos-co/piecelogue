import { useState } from 'react'
import Modal from './Modal'
import { useAuth } from '../hooks/useAuth'
import { formatUserError } from '../utils/userErrors'

function SignInForm({ onClose }) {
  const { requestLink } = useAuth()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [devMagicLink, setDevMagicLink] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const result = await requestLink(email.trim())
      setSent(true)
      setDevMagicLink(result?.dev?.magicLink ?? null)
    } catch (err) {
      setError(formatUserError(err, 'Unable to send a sign-in link. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="sign-in-success">
        <p className="settings-text">Check your email for a sign-in link.</p>

        {import.meta.env.DEV && devMagicLink ? (
          <div className="settings-dev-login">
            <a href={devMagicLink} className="btn btn--secondary btn--sm">
              Development Login
            </a>
            <p className="settings-text settings-text--muted settings-dev-login-note">
              Local development only — opens the magic link directly.
            </p>
          </div>
        ) : null}

        <div className="form-actions">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="sign-in-form">
      {error ? (
        <div className="form-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="form-group">
        <label htmlFor="sign-in-email" className="form-label form-label--required">
          Email address
        </label>
        <input
          id="sign-in-email"
          type="email"
          className="form-input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
          autoFocus
        />
      </div>

      <div className="form-actions">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={onClose}
          disabled={submitting}
        >
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? 'Sending...' : 'Send sign-in link'}
        </button>
      </div>
    </form>
  )
}

export default function SignInDialog({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sign in with email" className="modal--small">
      {isOpen ? <SignInForm key="sign-in" onClose={onClose} /> : null}
    </Modal>
  )
}
