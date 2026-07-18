import { apiFetch } from '../utils/api.js'

/**
 * Use POST for destructive account actions.
 * Some iOS Safari / Home Screen contexts strip bodies from DELETE requests,
 * which made confirmation checks fail and surfaced as generic cloud-delete errors.
 */
export async function deleteCloudData(confirmation) {
  return apiFetch('/api/account/cloud-data', {
    method: 'POST',
    body: JSON.stringify({ confirmation }),
  })
}

export async function deleteAccount(confirmation) {
  return apiFetch('/api/account', {
    method: 'POST',
    body: JSON.stringify({ confirmation }),
  })
}
