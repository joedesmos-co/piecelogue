import { apiFetch } from '../utils/api'

export async function deleteCloudData(confirmation) {
  return apiFetch('/api/account/cloud-data', {
    method: 'DELETE',
    body: JSON.stringify({ confirmation }),
  })
}

export async function deleteAccount(confirmation) {
  return apiFetch('/api/account', {
    method: 'DELETE',
    body: JSON.stringify({ confirmation }),
  })
}
