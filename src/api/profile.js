import { apiFetch } from '../utils/api.js'

export async function fetchProfile() {
  const data = await apiFetch('/api/profile')
  return {
    profile: data.profile ?? null,
  }
}

export async function updateUsername(username) {
  const data = await apiFetch('/api/profile/username', {
    method: 'PATCH',
    body: JSON.stringify({ username }),
  })
  return {
    profile: data.profile ?? null,
  }
}
