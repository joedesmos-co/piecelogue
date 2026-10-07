import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  UNKNOWN_DURATION_LABEL,
  formatArtworkDuration,
  formatTime,
  isDurationUnknown,
} from './formatTime.js'
import { toCloudArtworkMetadata } from '../sync/cloudPayload.js'
import { toLocalArtworkMetadata } from '../sync/restoreLogic.js'

describe('unknown duration display', () => {
  it('never renders unknown time as 0 min', () => {
    assert.equal(
      formatArtworkDuration({ durationUnknown: true, totalMinutes: null }),
      UNKNOWN_DURATION_LABEL,
    )
    assert.notEqual(UNKNOWN_DURATION_LABEL, '0 min')
  })

  it('treats null totalMinutes as unknown', () => {
    assert.equal(isDurationUnknown({ totalMinutes: null }), true)
    assert.equal(isDurationUnknown({ totalMinutes: 0 }), false)
    assert.equal(isDurationUnknown({ durationUnknown: true, totalMinutes: 90 }), true)
  })

  it('still formats known durations normally', () => {
    assert.equal(formatArtworkDuration({ totalMinutes: 90 }), '1 hr 30 min')
    assert.equal(formatTime(0), '0 min')
  })
})

describe('unknown duration sync payload', () => {
  it('sends the explicit flag and zeroed minutes to the cloud', () => {
    const payload = toCloudArtworkMetadata({
      id: 'a1',
      title: 'Study',
      hours: null,
      minutes: null,
      totalMinutes: null,
      durationUnknown: true,
    })
    assert.equal(payload.durationUnknown, true)
    assert.equal(payload.totalMinutes, 0)
  })

  it('marks known durations as known', () => {
    const payload = toCloudArtworkMetadata({
      id: 'a1',
      title: 'Study',
      hours: 1,
      minutes: 30,
      totalMinutes: 90,
    })
    assert.equal(payload.durationUnknown, false)
    assert.equal(payload.totalMinutes, 90)
  })

  it('restores unknown durations as null locally', () => {
    const local = toLocalArtworkMetadata({
      id: 'a1',
      title: 'Study',
      hours: 0,
      minutes: 0,
      totalMinutes: 0,
      durationUnknown: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })
    assert.equal(local.durationUnknown, true)
    assert.equal(local.totalMinutes, null)
    assert.equal(local.hours, null)
  })

  it('restores legacy rows without the flag as known', () => {
    const local = toLocalArtworkMetadata({
      id: 'a1',
      title: 'Study',
      hours: 0,
      minutes: 0,
      totalMinutes: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })
    assert.equal(local.durationUnknown, false)
    assert.equal(local.totalMinutes, 0)
  })
})
