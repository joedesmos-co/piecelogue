import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { COORDINATOR_STATE, SYNC_REASON, createSyncCoordinator } from './coordinator.js'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('coordinator: gating', () => {
  it('does nothing when disabled (logged out / offline)', async () => {
    let pulls = 0
    const coordinator = createSyncCoordinator({
      isEnabled: () => false,
      pullRemoteChanges: async () => {
        pulls += 1
      },
    })

    const result = await coordinator.requestSyncCycle(SYNC_REASON.INITIAL)

    assert.equal(pulls, 0)
    assert.equal(result.skipped, 'disabled')
  })

  it('does not pull when the cheap status gate says nothing changed', async () => {
    let pulls = 0
    const coordinator = createSyncCoordinator({
      isEnabled: () => true,
      shouldPull: async () => false,
      pullRemoteChanges: async () => {
        pulls += 1
      },
    })

    await coordinator.requestSyncCycle(SYNC_REASON.FOCUS)

    assert.equal(pulls, 0)
  })

  it('pushes before pulling', async () => {
    const order = []
    const coordinator = createSyncCoordinator({
      isEnabled: () => true,
      shouldPull: async () => true,
      pushPendingWork: async () => order.push('push'),
      pullRemoteChanges: async () => {
        order.push('pull')
        return { changed: false }
      },
    })

    await coordinator.requestSyncCycle(SYNC_REASON.INITIAL)

    assert.deepEqual(order, ['push', 'pull'])
  })
})

describe('coordinator: single flight', () => {
  it('never runs two cycles concurrently', async () => {
    let active = 0
    let maxActive = 0
    const gate = deferred()

    const coordinator = createSyncCoordinator({
      isEnabled: () => true,
      shouldPull: async () => true,
      pullRemoteChanges: async () => {
        active += 1
        maxActive = Math.max(maxActive, active)
        await gate.promise
        active -= 1
        return { changed: false }
      },
    })

    const first = coordinator.requestSyncCycle(SYNC_REASON.INITIAL)
    await flush()

    // Fire many triggers while the first cycle is still running.
    const others = [
      coordinator.requestSyncCycle(SYNC_REASON.LOCAL),
      coordinator.requestSyncCycle(SYNC_REASON.FOCUS),
      coordinator.requestSyncCycle(SYNC_REASON.INTERVAL),
      coordinator.requestSyncCycle(SYNC_REASON.ONLINE),
    ]

    gate.resolve()
    await Promise.all([first, ...others])
    await flush()

    assert.equal(maxActive, 1, 'cycles must never overlap')
  })

  it('coalesces mid-cycle triggers into exactly one follow-up pass', async () => {
    let cycles = 0
    const gate = deferred()

    const coordinator = createSyncCoordinator({
      isEnabled: () => true,
      shouldPull: async () => true,
      pullRemoteChanges: async () => {
        cycles += 1
        if (cycles === 1) {
          await gate.promise
        }
        return { changed: false }
      },
    })

    const first = coordinator.requestSyncCycle(SYNC_REASON.INITIAL)
    await flush()

    // Ten triggers during one running cycle must not create ten extra cycles.
    for (let i = 0; i < 10; i += 1) {
      coordinator.requestSyncCycle(SYNC_REASON.FOCUS)
    }

    gate.resolve()
    await first
    await flush()
    await flush()

    assert.equal(cycles, 2, 'exactly one initial cycle plus one follow-up')
  })

  it('reports running state while a cycle is in flight', async () => {
    const gate = deferred()
    const coordinator = createSyncCoordinator({
      isEnabled: () => true,
      shouldPull: async () => true,
      pullRemoteChanges: async () => {
        await gate.promise
        return { changed: false }
      },
    })

    const cycle = coordinator.requestSyncCycle(SYNC_REASON.INITIAL)
    await flush()

    assert.equal(coordinator.isRunning(), true)
    assert.equal(coordinator.getState().state, COORDINATOR_STATE.SYNCING)

    gate.resolve()
    await cycle

    assert.equal(coordinator.isRunning(), false)
    assert.equal(coordinator.getState().state, COORDINATOR_STATE.IDLE)
  })

  it('bounds follow-up passes so triggers cannot loop forever', async () => {
    let cycles = 0
    const coordinator = createSyncCoordinator({
      isEnabled: () => true,
      shouldPull: async () => true,
      maxFollowUps: 2,
      pullRemoteChanges: async () => {
        cycles += 1
        // Re-trigger on every pass, simulating a busy system.
        if (cycles < 20) {
          coordinator.requestSyncCycle(SYNC_REASON.FOCUS)
        }
        return { changed: false }
      },
    })

    await coordinator.requestSyncCycle(SYNC_REASON.INITIAL)
    await flush()
    await flush()

    assert.ok(cycles <= 4, `expected the cycle count to stay bounded, got ${cycles}`)
  })
})

describe('coordinator: throttling', () => {
  it('throttles repeated focus checks', async () => {
    let clock = 1_000_000
    let cycles = 0
    const coordinator = createSyncCoordinator({
      isEnabled: () => true,
      shouldPull: async () => true,
      minIntervalMs: 15_000,
      now: () => clock,
      pullRemoteChanges: async () => {
        cycles += 1
        return { changed: false }
      },
    })

    await coordinator.requestSyncCycle(SYNC_REASON.FOCUS)
    assert.equal(cycles, 1)

    // Tab switching seconds later must not hammer the API.
    clock += 1_000
    const throttled = await coordinator.requestSyncCycle(SYNC_REASON.FOCUS)
    assert.equal(throttled.skipped, 'throttled')
    assert.equal(cycles, 1)

    clock += 20_000
    await coordinator.requestSyncCycle(SYNC_REASON.FOCUS)
    assert.equal(cycles, 2)
  })

  it('never throttles local edits or manual syncs', async () => {
    let clock = 1_000_000
    let cycles = 0
    const coordinator = createSyncCoordinator({
      isEnabled: () => true,
      shouldPull: async () => true,
      minIntervalMs: 15_000,
      now: () => clock,
      pullRemoteChanges: async () => {
        cycles += 1
        return { changed: false }
      },
    })

    await coordinator.requestSyncCycle(SYNC_REASON.LOCAL)
    await coordinator.requestSyncCycle(SYNC_REASON.LOCAL)
    await coordinator.requestSyncCycle(SYNC_REASON.MANUAL)

    assert.equal(cycles, 3, 'each local edit and manual sync must run')
  })
})

describe('coordinator: change reporting', () => {
  it('notifies only when the pull actually changed something', async () => {
    let changes = 0
    const coordinator = createSyncCoordinator({
      isEnabled: () => true,
      shouldPull: async () => true,
      pullRemoteChanges: async () => ({ changed: false }),
      onChanged: () => {
        changes += 1
      },
    })

    await coordinator.requestSyncCycle(SYNC_REASON.FOCUS)
    assert.equal(changes, 0)
  })

  it('notifies with the reason when the pull changed data', async () => {
    const seen = []
    const coordinator = createSyncCoordinator({
      isEnabled: () => true,
      shouldPull: async () => true,
      pullRemoteChanges: async () => ({ changed: true, downloaded: 2 }),
      onChanged: (result, reason) => seen.push({ downloaded: result.downloaded, reason }),
    })

    await coordinator.requestSyncCycle(SYNC_REASON.ONLINE)

    assert.equal(seen.length, 1)
    assert.equal(seen[0].downloaded, 2)
    assert.equal(seen[0].reason, SYNC_REASON.ONLINE)
  })

  it('survives a pull failure without wedging the coordinator', async () => {
    let cycles = 0
    const errors = []
    const coordinator = createSyncCoordinator({
      isEnabled: () => true,
      shouldPull: async () => true,
      pullRemoteChanges: async () => {
        cycles += 1
        throw new Error('network down')
      },
      onError: (error) => errors.push(error.message),
    })

    const failed = await coordinator.requestSyncCycle(SYNC_REASON.FOCUS)
    assert.equal(failed.changed, false)
    assert.equal(errors.length, 1)
    assert.equal(coordinator.isRunning(), false)

    // The next cycle must still be able to run.
    await coordinator.requestSyncCycle(SYNC_REASON.MANUAL)
    assert.equal(cycles, 2)
  })

  it('reset clears runtime state', async () => {
    const coordinator = createSyncCoordinator({
      isEnabled: () => true,
      shouldPull: async () => true,
      pullRemoteChanges: async () => ({ changed: false }),
    })

    await coordinator.requestSyncCycle(SYNC_REASON.INITIAL)
    assert.equal(coordinator.getState().cycleCount, 1)

    coordinator.reset()
    assert.equal(coordinator.getState().cycleCount, 0)
  })
})