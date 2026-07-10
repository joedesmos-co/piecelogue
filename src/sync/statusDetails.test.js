import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { describeSyncJobStage, summarizeSyncFailures } from './statusDetails.js'
import { SYNC_ENTITY_TYPES } from './constants.js'

describe('sync status details', () => {
  it('maps entity types to user-facing stages', () => {
    assert.equal(describeSyncJobStage(SYNC_ENTITY_TYPES.FOLDER), 'folders')
    assert.equal(describeSyncJobStage(SYNC_ENTITY_TYPES.ARTWORK), 'metadata')
    assert.equal(describeSyncJobStage(SYNC_ENTITY_TYPES.ARTWORK_IMAGE), 'images')
  })

  it('summarizes failed jobs without hiding stage information', () => {
    const failures = summarizeSyncFailures([
      {
        status: 'failed',
        entityType: SYNC_ENTITY_TYPES.ARTWORK_IMAGE,
        lastError: 'Upload timed out.',
      },
      {
        status: 'failed',
        entityType: SYNC_ENTITY_TYPES.ARTWORK_IMAGE,
        lastError: 'Upload timed out.',
      },
      {
        status: 'pending',
        entityType: SYNC_ENTITY_TYPES.ARTWORK,
        lastError: null,
      },
    ])

    assert.equal(failures.length, 1)
    assert.equal(failures[0].stage, 'images')
    assert.equal(failures[0].count, 2)
  })
})
