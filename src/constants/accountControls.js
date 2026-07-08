export const DELETE_ACCOUNT_CONFIRMATION = 'DELETE MY ACCOUNT'
export const DELETE_CLOUD_DATA_CONFIRMATION = 'DELETE CLOUD DATA'

export function validateDeleteAccountConfirmation(value) {
  return String(value ?? '').trim() === DELETE_ACCOUNT_CONFIRMATION
}

export function validateDeleteCloudDataConfirmation(value) {
  return String(value ?? '').trim() === DELETE_CLOUD_DATA_CONFIRMATION
}
