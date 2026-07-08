import { apiFetch } from '../utils/api'

export async function fetchMe() {
  const data = await apiFetch('/api/auth/me')
  return {
    authenticated: Boolean(data.authenticated),
    user: data.user ?? null,
  }
}

export async function requestSignInLink(email) {
  return apiFetch('/api/auth/request-link', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function logout() {
  return apiFetch('/api/auth/logout', { method: 'POST' })
}
