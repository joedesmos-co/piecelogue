/**
 * How long a single wheel spin takes, in milliseconds.
 *
 * The page and the wheel component share this so the animation and the
 * sequence timer can never drift apart.
 */
export const WHEEL_SPIN_DURATION_MS = 1200

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

/**
 * Build a temporary wheel face from a pool of values.
 *
 * The wheel is a readable object, not a database dump: only a slice of the
 * pool is on the wheel at any one time. The selected value is always present,
 * so the wheel can physically land on the result it produced.
 */
function secureRng() {
  if (typeof crypto !== 'undefined' && crypto && typeof crypto.getRandomValues === 'function') {
    return () => {
      const arr = new Uint32Array(1)
      crypto.getRandomValues(arr)
      return arr[0] / 0x100000000
    }
  }
  return Math.random
}

export function getWheelCandidates(pool, selectedValue, count = 16, rng) {
  const source = Array.isArray(pool) ? pool : []
  const roller = typeof rng === 'function' ? rng : secureRng()
  const targetCount = Math.min(
    Math.max(12, Math.min(Number(count) || 16, 20)),
    source.length > 0 ? source.length : 1,
  )
  const chosen = new Set()
  if (selectedValue != null && selectedValue !== '') chosen.add(selectedValue)
  const shuffledPool = [...source]
  for (let i = shuffledPool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(roller() * (i + 1))
    ;[shuffledPool[i], shuffledPool[j]] = [shuffledPool[j], shuffledPool[i]]
  }
  for (const value of shuffledPool) {
    if (chosen.size >= targetCount) break
    chosen.add(value)
  }
  if (selectedValue != null && selectedValue !== '') chosen.add(selectedValue)
  const result = [...chosen]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(roller() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  if (result.length === 0) {
    return selectedValue != null && selectedValue !== '' ? [selectedValue] : source.slice(0, 1)
  }
  return result
}

export const buildWheelCandidates = getWheelCandidates
export const createWheelCandidates = getWheelCandidates

/**
 * Short display labels for the wheel.
 *
 * The wheel needs big, bold, glanceable wording. The underlying value is
 * always preserved for the result panel and the generated prompt.
 */
export const WHEEL_DISPLAY_LABELS = {
  'using only three colors': '3 COLORS',
  'using only two colors': '2 COLORS',
  'with no erasing': 'NO ERASING',
  'in monochrome': 'MONOCHROME',
  'with one accent color': 'ONE ACCENT',
  'using only basic shapes': 'BASIC SHAPES',
  'with continuous line': 'CONTINUOUS LINE',
  'with no outlines': 'NO OUTLINES',
  'using one pencil': 'ONE PENCIL',
  'with bold outlines': 'BOLD OUTLINES',
  'in a limited palette': 'LIMITED PAL.',
  'with soft shading': 'SOFT SHADING',
  'using flat colors': 'FLAT COLORS',
  'with high contrast': 'HIGH CONTRAST',
  'in black and white': 'BLACK & WHITE',
  'with textured strokes': 'TEXTURED',
  'in an abandoned mall': 'ABANDONED MALL',
  'on a rainy rooftop': 'RAINY ROOFTOP',
  'at a quiet bus stop': 'QUIET BUS STOP',
  'in a foggy harbor': 'FOGGY HARBOR',
  'in a cluttered studio': 'MESSY STUDIO',
  'on a hilltop at dusk': 'HILLTOP DUSK',
  'in a neon alley': 'NEON ALLEY',
  'in a sunlit kitchen': 'SUNLIT KITCHEN',
  'in a junkyard': 'JUNKYARD',
  'in a snowy forest': 'SNOWY FOREST',
  'on a train platform': 'TRAIN PLATFORM',
  'in an overgrown greenhouse': 'GREENHOUSE',
  'in a rainy forest': 'RAINY FOREST',
  'on a city rooftop': 'CITY ROOFTOP',
  'in a quiet library': 'QUIET LIBRARY',
  'at a night market': 'NIGHT MARKET',
  'in a snowy village': 'SNOWY VILLAGE',
  'by a lighthouse': 'LIGHTHOUSE',
  'in a desert town': 'DESERT TOWN',
  'on a mountain trail': 'MOUNTAIN TRAIL',
  'in a coastal village': 'COASTAL VILLAGE',
}

/**
 * Short display label for a wheel value. Falls back to a compact, uppercased
 * version of the original wording so unknown values still fit the wheel.
 */
export function getWheelDisplayLabel(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  const mapped = WHEEL_DISPLAY_LABELS[text.toLowerCase()]
  if (mapped) return mapped
  const cleaned = text
    .replace(/^(in|on|at|by|with|using|a|an|the)\s+/i, '')
    .replace(/\s+(in|on|at|by)\s+/gi, ' ')
    .trim()
  const label = (cleaned || text).toUpperCase()
  if (label.length > 13) return label.slice(0, 12) + '…'
  return label
}

/**
 * Rough advance width per character for Barlow Condensed 800 uppercase.
 * Used to size wheel labels so they never overflow their slice.
 */
export const WHEEL_CHAR_WIDTH = 0.54
export const WHEEL_SPACE_WIDTH = 0.28
// Wheel labels are set with a little tracking, which adds to the run length.
export const WHEEL_LETTER_SPACING = 0.05

export function estimateWheelLabelWidth(text) {
  const value = String(text ?? '')
  let width = 0
  for (const char of value) {
    width += char === ' ' ? WHEEL_SPACE_WIDTH : WHEEL_CHAR_WIDTH
  }
  return width + Math.max(0, value.length - 1) * WHEEL_LETTER_SPACING
}

/**
 * Widest wheel label across the whole dataset, in em units.
 *
 * The wheel prints one type size for the entire face, so this is measured once
 * against the longest label the wheel can ever show.
 */
export const WHEEL_MAX_LABEL_WIDTH = 7.3

export const WHEEL_MAX_LABEL_FONT = 12
export const WHEEL_MIN_LABEL_FONT = 9

/**
 * Initial font size for a wheel label, scaled to its available space.
 * The component then measures the actual rendered text and shrinks further
 * when needed. There is no minimum size that can force a label to overflow.
 *
 * `labelRadius` and `labelInset` describe where the labels are printed on the
 * wheel face; `arcLength` is the usable arc a single slice gets.
 */
export function getWheelLabelFontSize(
  sliceCount,
  labelWidth = WHEEL_MAX_LABEL_WIDTH,
  labelRadius = 178,
  labelInset = 1.2,
) {
  const count = Math.max(1, Number(sliceCount) || 1)
  const seg = 360 / count
  const arcLength = ((seg - labelInset * 2) * Math.PI * labelRadius) / 180
  // Radial labels must fit both the wedge width and the radial depth.
  const radialDepth = 86
  const byWidth = arcLength * 0.7
  const byDepth = (radialDepth * 0.82) / Math.max(0.5, Number(labelWidth) || WHEEL_MAX_LABEL_WIDTH)
  const size = Math.min(byWidth, byDepth)
  return Math.max(0, Math.min(WHEEL_MAX_LABEL_FONT, size))
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
