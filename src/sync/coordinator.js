/**
 * Single synchronization coordinator.
 *
 * All sync triggers (app load, login, focus, reconnect, local edit, periodic
 * tick) funnel through requestSyncCycle(). Only one cycle ever runs at a time;
 * triggers arriving mid-cycle schedule exactly one follow-up pass instead of
 * starting a competing cycle.
 *
 * A cycle is: push pending local work -> cheaply check cloud status -> pull and
 * merge only if something changed -> reconcile images -> notify the UI.
 *
 * Nothing here blocks rendering: every entry point returns immediately.
 */

export const SYNC_REASON = {
  INITIAL: 'initial',
  LOGIN: 'login',
  FOCUS: 'focus',
  ONLINE: 'online',
  LOCAL: 'local',
  INTERVAL: 'interval',
  MANUAL: 'manual',
  FOLLOW_UP: 'follow-up',
}

// Reasons that must never be throttled away: they represent real pending work.
const URGENT_REASONS = new Set([
  SYNC_REASON.INITIAL,
  SYNC_REASON.LOGIN,
  SYNC_REASON.LOCAL,
  SYNC_REASON.MANUAL,
  SYNC_REASON.FOLLOW_UP,
])

export const COORDINATOR_STATE = {
  IDLE: 'idle',
  SYNCING: 'syncing',
}

export function createSyncCoordinator({
  isEnabled = () => true,
  pushPendingWork = async () => {},
  shouldPull = async () => true,
  pullRemoteChanges = async () => ({ changed: false }),
  onChanged = () => {},
  onError = () => {},
  now = () => Date.now(),
  minIntervalMs = 15_000,
  maxFollowUps = 2,
} = {}) {
  let running = false
  let followUpRequested = false
  let followUpCount = 0
  let lastCycleAt = 0
  let state = COORDINATOR_STATE.IDLE
  let cycleCount = 0
  let lastError = null

  function shouldThrottle(reason, timestamp) {
    if (URGENT_REASONS.has(reason)) {
      return false
    }
    if (lastCycleAt === 0) {
      return false
    }
    return timestamp - lastCycleAt < minIntervalMs
  }

  async function runCycle(reason) {
    state = COORDINATOR_STATE.SYNCING
    try {
      // Push first so freshly-made local edits reach the cloud before we ask
      // whether the cloud has anything new. This avoids echo loops.
      await pushPendingWork()

      const wanted = await shouldPull()
      let result = { changed: false }

      if (wanted) {
        result = (await pullRemoteChanges()) ?? { changed: false }
      }

      cycleCount += 1
      lastCycleAt = now()

      if (result.changed) {
        onChanged(result, reason)
      }
      lastError = null
      return result
    } catch (error) {
      lastError = error
      onError(error)
      return { changed: false, error }
    } finally {
      state = COORDINATOR_STATE.IDLE
    }
  }

  async function drain(reason) {
    if (running) {
      // Collapse any number of mid-cycle triggers into one follow-up pass.
      followUpRequested = true
      return { coalesced: true }
    }

    const timestamp = now()
    if (!isEnabled()) {
      return { skipped: 'disabled' }
    }
    if (shouldThrottle(reason, timestamp)) {
      return { skipped: 'throttled' }
    }

    running = true
    followUpCount = 0
    try {
      let result
      let currentReason = reason

      do {
        followUpRequested = false
        result = await runCycle(currentReason)

        if (followUpRequested && followUpCount < maxFollowUps) {
          followUpCount += 1
          currentReason = SYNC_REASON.FOLLOW_UP
        } else {
          followUpRequested = false
        }
      } while (followUpRequested && followUpCount < maxFollowUps)

      return result
    } finally {
      running = false
      followUpRequested = false
    }
  }

  return {
    requestSyncCycle: (reason = SYNC_REASON.INITIAL) => drain(reason),
    isRunning: () => running,
    getState: () => ({
      state,
      cycleCount,
      lastCycleAt,
      lastError,
    }),
    reset: () => {
      running = false
      followUpRequested = false
      followUpCount = 0
      lastCycleAt = 0
      cycleCount = 0
      lastError = null
      state = COORDINATOR_STATE.IDLE
    },
  }
}