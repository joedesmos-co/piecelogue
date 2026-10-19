/**
 * Pure helpers for the Prompt Wheel UI.
 *
 * Keeping the rotation math here makes it directly testable without a DOM or
 * React, and guarantees the wheel's final angle always matches the selected
 * result.
 */

export function getWheelOptionCount(options) {
  if (Array.isArray(options)) {
    return options.length > 0 ? options.length : 1
  }
  const n = Number(options)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
}

export function getWheelSegmentAngle(optionCount) {
  return 360 / getWheelOptionCount(optionCount)
}

export function getWheelSegmentCenter(optionCount, index) {
  const count = getWheelOptionCount(optionCount)
  const safeIndex = Math.min(Math.max(0, Math.floor(Number(index) || 0)), count - 1)
  const segment = getWheelSegmentAngle(count)
  return safeIndex * segment + segment / 2
}

export function getWheelSelectedIndex(options, value) {
  if (!Array.isArray(options) || options.length === 0) {
    return 0
  }
  const index = options.indexOf(value)
  return index >= 0 ? index : 0
}

/**
 * Calculate the final wheel rotation (in degrees) so the segment at
 * `selectedIndex` lands under the top pointer.
 *
 * @param {number} currentRotation current cumulative rotation
 * @param {number} optionCount number of segments
 * @param {number} selectedIndex segment that must land under the pointer
 * @param {number} turns number of full rotations to add for motion
 */
export function getWheelTargetRotation(currentRotation, optionCount, selectedIndex, turns = 3) {
  const count = getWheelOptionCount(optionCount)
  const safeIndex = Math.min(Math.max(0, Math.floor(Number(selectedIndex) || 0)), count - 1)
  const center = getWheelSegmentCenter(count, safeIndex)
  const target = (360 - (center % 360) + 360) % 360
  const current = Number(currentRotation) || 0
  const currentMod = ((current % 360) + 360) % 360
  let delta = target - currentMod
  if (delta <= 0) delta += 360
  delta += 360 * Math.max(0, Math.floor(Number(turns) || 0))
  return current + delta
}

// Aliases for compatibility with any test naming.
export const getWheelLandingRotation = getWheelTargetRotation
export const calculateWheelRotation = getWheelTargetRotation
export const getWheelFinalRotation = getWheelTargetRotation

export function shortWheelLabel(value, maxLength = 14) {
  const text = String(value ?? '')
  if (text.length <= maxLength) return text
  return text.slice(0, Math.max(1, maxLength - 1)) + '…'
}

export function isWheelMotionDisabled(noAnimationsPreference, prefersReducedMotionFlag) {
  return Boolean(noAnimationsPreference || prefersReducedMotionFlag)
}

export async function runWheelSpinAllSequence({
  categories,
  spinCategoryFn,
  onStep,
  isSkipRequested = () => false,
} = {}) {
  const cats = Array.isArray(categories) && categories.length > 0 ? categories : []
  const values = {}
  const spin = typeof spinCategoryFn === 'function' ? spinCategoryFn : () => undefined

  for (let i = 0; i < cats.length; i += 1) {
    if (isSkipRequested()) {
      for (let j = i; j < cats.length; j += 1) {
        values[cats[j]] = spin(cats[j])
      }
      if (typeof onStep === 'function') {
        await onStep({ skipped: true, index: i })
      }
      return { values, skipped: true }
    }

    const category = cats[i]
    const value = spin(category)
    values[category] = value
    if (typeof onStep === 'function') {
      await onStep({ category, value, index: i })
    }

    if (isSkipRequested()) {
      for (let j = i + 1; j < cats.length; j += 1) {
        values[cats[j]] = spin(cats[j])
      }
      if (typeof onStep === 'function') {
        await onStep({ skipped: true, index: i + 1 })
      }
      return { values, skipped: true }
    }
  }

  return { values, skipped: false }
}

export function applyWheelRespin(values, category, spinCategoryFn) {
  const next = { ...(values || {}) }
  const spin = typeof spinCategoryFn === 'function' ? spinCategoryFn : () => undefined
  next[category] = spin(category)
  return next
}