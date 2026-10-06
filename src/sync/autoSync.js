/**
 * Wires the coordinator to real triggers and real I/O.
 *
 * Local IndexedDB remains the source of truth: every cycle writes to Dexie
 * first/only, and cloud state is merged in according to revision. Nothing in
 * here blocks rendering — requestSyncCycle() returns immediately.
 */

import { fetchCloudStatus } from '../api/cloud.js'
import { getSyncJobsForUser } from '../db/syncQueueService.js'
import { SYNC_JOB_STATUS } from './constants.js'
import { createSyncCoordinator, SYNC_REASON } from './coordinator.js'
import { shouldPullLibrary } from './mergeLogic.js'
import { pullAndMerge } from './autoPull.js'
import {
  waitForBackgroundProcessorIdle,
  wakeSyncProcessor,
} from './processor.js'

const VISIBLE_INTERVAL_MS = 45_000
const FOCUS_DEBOUNCE_MS = 3_000
const PUSH_DRAIN_TIMEOUT_MS = 20_000

let coordinator = null
let activeUserId = null
let lastSeenCloudStatus = null
let onChangedHandler = null
let intervalId = null
let listenersAttached = false
let focusTimer = null

function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

function isDocumentVisible() {
  return typeof document === 'undefined' ? true : document.visibilityState === 'visible'
}

async function hasPendingLocalWork(userId) {
  const jobs = await getSyncJobsForUser(userId)
  return jobs.some(
    (job) =>
      job.status === SYNC_JOB_STATUS.PENDING ||
      job.status === SYNC_JOB_STATUS.FAILED ||
      job.status === SYNC_JOB_STATUS.CONFLICT,
  )
}

/**
 * Push everything currently queued, bounded so a stuck upload cannot stall the
 * cycle. A timeout here is not fatal: the pull still runs and the processor
 * retries on its own schedule.
 */
async function pushPendingWork() {
  wakeSyncProcessor()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PUSH_DRAIN_TIMEOUT_MS)
  try {
    await waitForBackgroundProcessorIdle(controller.signal, PUSH_DRAIN_TIMEOUT_MS)
  } catch {
    // Timed out or aborted: continue to the pull phase anyway.
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Cheap gate: only fetch the full library when /api/cloud/status says
 * something changed, or when this device has work of its own to reconcile.
 */
async function shouldPull() {
  if (!activeUserId) {
    return false
  }

  let cloudStatus = null
  try {
    cloudStatus = await fetchCloudStatus()
  } catch {
    // Status is a cheap optimization, not a gate: if it fails, pull anyway and
    // let pullAndMerge surface any real error.
  }

  const wanted = shouldPullLibrary({
    cloudStatus,
    lastSeenCloudStatus,
    hasPendingLocalWork: await hasPendingLocalWork(activeUserId),
  })

  if (wanted && cloudStatus) {
    lastSeenCloudStatus = cloudStatus
  }
  return wanted
}

async function pullRemoteChanges() {
  const result = await pullAndMerge({ userId: activeUserId })
  if (result.changed && onChangedHandler) {
    onChangedHandler(result)
  }
  return result
}

function buildCoordinator() {
  return createSyncCoordinator({
    isEnabled: () => Boolean(activeUserId) && isOnline(),
    pushPendingWork,
    shouldPull,
    pullRemoteChanges,
    onChanged: (result) => onChangedHandler?.(result),
    onError: () => {},
    minIntervalMs: FOCUS_DEBOUNCE_MS,
  })
}

function clearTimers() {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
  }
  if (focusTimer !== null) {
    clearTimeout(focusTimer)
    focusTimer = null
  }
}

function handleFocusLike() {
  if (!activeUserId || !isOnline()) {
    return
  }
  if (focusTimer !== null) {
    clearTimeout(focusTimer)
  }
  focusTimer = setTimeout(() => {
    focusTimer = null
    coordinator?.requestSyncCycle(SYNC_REASON.FOCUS)
  }, FOCUS_DEBOUNCE_MS)
}

function handleOnline() {
  coordinator?.requestSyncCycle(SYNC_REASON.ONLINE)
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    handleFocusLike()
  }
}

function attachListeners() {
  if (listenersAttached) {
    return
  }
  listenersAttached = true
  window.addEventListener('focus', handleFocusLike)
  window.addEventListener('pageshow', handleFocusLike)
  window.addEventListener('online', handleOnline)
  document.addEventListener('visibilitychange', handleVisibilityChange)
}

function detachListeners() {
  if (!listenersAttached) {
    return
  }
  listenersAttached = false
  window.removeEventListener('focus', handleFocusLike)
  window.removeEventListener('pageshow', handleFocusLike)
  window.removeEventListener('online', handleOnline)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
}

export function startAutoSync({ userId, onChanged } = {}) {
  stopAutoSync()

  if (!userId) {
    return
  }

  activeUserId = userId
  onChangedHandler = onChanged ?? null
  lastSeenCloudStatus = null
  coordinator = buildCoordinator()
  attachListeners()

  // Periodic check only while the tab is actually visible.
  intervalId = setInterval(() => {
    if (!activeUserId || !isOnline() || !isDocumentVisible()) {
      return
    }
    coordinator.requestSyncCycle(SYNC_REASON.INTERVAL)
  }, VISIBLE_INTERVAL_MS)

  coordinator.requestSyncCycle(SYNC_REASON.INITIAL)
}

export function stopAutoSync() {
  clearTimers()
  detachListeners()
  activeUserId = null
  onChangedHandler = null
  lastSeenCloudStatus = null
  coordinator?.reset()
  coordinator = null
}

/** Called after a local mutation is persisted and queued. Never blocks. */
export function notifyLocalChange() {
  coordinator?.requestSyncCycle(SYNC_REASON.LOCAL)
}

/** Manual "Sync now". Returns the cycle result for UI feedback. */
export function requestManualSync() {
  return coordinator?.requestSyncCycle(SYNC_REASON.MANUAL) ?? Promise.resolve({})
}

export function getAutoSyncState() {
  return coordinator?.getState() ?? { state: 'idle', cycleCount: 0, lastCycleAt: 0, lastError: null }
}

export { SYNC_REASON }