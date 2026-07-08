let activeUserId = null

export function setActiveSyncUserId(userId) {
  activeUserId = userId || null
}

export function getActiveSyncUserId() {
  return activeUserId
}

export function assertActiveUserScope(userId) {
  if (!activeUserId) {
    return false
  }
  return userId === activeUserId
}
