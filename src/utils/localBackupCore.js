const BACKUP_VERSION = 1
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024

export function getBackupVersion() {
  return BACKUP_VERSION
}

export function validateLocalBackup(backup) {
  if (!backup || typeof backup !== 'object') {
    throw new Error('Invalid backup file.')
  }

  if (backup.backupVersion !== BACKUP_VERSION) {
    throw new Error('Unsupported backup version. Export a new backup from Piecelogue.')
  }

  if (!Array.isArray(backup.folders) || !Array.isArray(backup.artworks)) {
    throw new Error('Backup file is missing folders or artworks.')
  }

  for (const folder of backup.folders) {
    if (!folder?.id || !folder?.name) {
      throw new Error('Backup contains an invalid folder record.')
    }
  }

  for (const artwork of backup.artworks) {
    if (!artwork?.id || !artwork?.title) {
      throw new Error('Backup contains an invalid artwork record.')
    }
  }

  return backup
}

export function parseLocalBackupText(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Backup file is empty.')
  }

  if (text.length > MAX_BACKUP_BYTES) {
    throw new Error('Backup file is too large to import.')
  }

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Backup file is not valid JSON.')
  }

  return validateLocalBackup(parsed)
}
