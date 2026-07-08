import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseLocalBackupText, validateLocalBackup } from './localBackupCore.js'

const SAMPLE_BACKUP = {
  backupVersion: 1,
  app: 'Piecelogue',
  appVersion: '0.1.0',
  exportedAt: '2026-07-08T12:00:00.000Z',
  folderCount: 1,
  artworkCount: 1,
  folders: [
    {
      id: 'folder-1',
      name: 'Sketches',
      parentFolderId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
  ],
  artworks: [
    {
      id: 'art-1',
      title: 'Study',
      mediumType: 'Digital',
      medium: 'Procreate',
      folderId: 'folder-1',
      status: 'In Progress',
      hours: 1,
      minutes: 0,
      totalMinutes: 60,
      artworkDate: null,
      notes: '',
      favorite: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
  ],
}

describe('local backup validation', () => {
  it('accepts a valid backup payload', () => {
    assert.deepEqual(validateLocalBackup(SAMPLE_BACKUP), SAMPLE_BACKUP)
  })

  it('parses backup JSON text', () => {
    const parsed = parseLocalBackupText(JSON.stringify(SAMPLE_BACKUP))
    assert.equal(parsed.artworkCount, 1)
    assert.equal(parsed.folders[0].name, 'Sketches')
  })

  it('rejects unsupported backup versions', () => {
    assert.throws(
      () => validateLocalBackup({ ...SAMPLE_BACKUP, backupVersion: 99 }),
      /Unsupported backup version/,
    )
  })

  it('rejects invalid JSON', () => {
    assert.throws(() => parseLocalBackupText('{not json'), /not valid JSON/)
  })

  it('rejects backups missing required arrays', () => {
    assert.throws(() => validateLocalBackup({ backupVersion: 1 }), /missing folders or artworks/)
  })
})
