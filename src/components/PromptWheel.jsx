/**
 * Prompt Wheel — a real, physical-looking spinner.
 */

import {
  WHEEL_SPIN_DURATION_MS,
  getWheelLabelFontSize,
} from '../utils/promptWheel'

const VIEW = 400
const CX = 200
const CY = 200

const R_SLICE_IN = 92
const R_SLICE_OUT = 188
const R_TEXT = 178
const R_HUB = 58
const R_HUB_INNER = 48

const WEDGE_COLORS = [
  '#2f5bd6',
  '#b84a3a',
  '#c9a227',
  '#6f8f6b',
  '#7a6b9a',
  '#d97a3a',
  '#3f7f7a',
  '#e8dcc4',
]

function luminance(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function polar(angle, r) {
  const rad = ((angle - 90) * Math.PI) / 180
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

function slicePath(start, end) {
  const o1 = polar(start, R_SLICE_OUT)
  const o2 = polar(end, R_SLICE_OUT)
  const i1 = polar(end, R_SLICE_IN)
  const i2 = polar(start, R_SLICE_IN)
  const large = end - start > 180 ? 1 : 0
  return [
    `M ${o1.x.toFixed(2)} ${o1.y.toFixed(2)}`,
    `A ${R_SLICE_OUT} ${R_SLICE_OUT} 0 ${large} 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)}`,
    `L ${i1.x.toFixed(2)} ${i1.y.toFixed(2)}`,
    `A ${R_SLICE_IN} ${R_SLICE_IN} 0 ${large} 0 ${i2.x.toFixed(2)} ${i2.y.toFixed(2)}`,
    'Z',
  ].join(' ')
}

export default function PromptWheel({
  slices = [],
  category = 'SUBJECT',
  highlightValue = '',
  hubValue = '',
  rotation = 0,
  spinning = false,
  animated = true,
  onSpin,
}) {
  const options = slices.length > 0 ? slices : [{ value: '', label: '' }]
  const count = options.length
  const seg = 360 / count

  const labels = options.map((slice) => String(slice.label || '').toUpperCase())

  const fontSize = getWheelLabelFontSize(count, 7.3, 140, 1.2)
  const hubText = spinning ? 'SPINNING…' : String(hubValue || '').toUpperCase()
  const hubValueSize = Math.max(
    11,
    Math.min(19, 150 / Math.max(1, hubText.length * 0.55)),
  )
  const hubLabelSize = Math.max(
    9,
    Math.min(12, 150 / Math.max(1, category.length * 0.68)),
  )

  return (
    <div className={`prompt-wheel-stage-wrap${animated ? '' : ' prompt-wheel-stage-wrap--instant'}`}>
      <svg
        className="prompt-wheel-svg"
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <g
          className="prompt-wheel-disc"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition:
              animated && spinning
                ? `transform ${WHEEL_SPIN_DURATION_MS}ms cubic-bezier(0.12, 0.82, 0.18, 1)`
                : 'none',
          }}
        >
          {options.map((slice, index) => {
            const start = index * seg
            const end = (index + 1) * seg
            const isSelected = slice.value === highlightValue && highlightValue !== ''
            const fill = WEDGE_COLORS[index % WEDGE_COLORS.length]
            return (
              <path
                key={`slice-${slice.value}-${index}`}
                d={slicePath(start, end)}
                className={
                  'prompt-wheel-slice' +
                  (isSelected ? ' prompt-wheel-slice--selected' : '')
                }
                style={{ fill }}
              />
            )
          })}

          {options.map((slice, index) => {
            const mid = index * seg + seg / 2
            const p = polar(mid, R_TEXT)
            const color = WEDGE_COLORS[index % WEDGE_COLORS.length]
            const textFill = luminance(color) > 0.55 ? '#1b2024' : '#ffffff'
            // Keep every label upright: flip the top/right half by 180°.
            const flipped = mid < 180
            const angle = flipped ? mid + 270 : mid + 90
            return (
              <text
                key={`label-${slice.value}-${index}`}
                x={p.x.toFixed(2)}
                y={p.y.toFixed(2)}
                transform={`rotate(${angle.toFixed(2)}, ${p.x.toFixed(2)}, ${p.y.toFixed(2)})`}
                className={
                  'prompt-wheel-slice-label' +
                  (slice.value === highlightValue && highlightValue !== ''
                    ? ' prompt-wheel-slice-label--selected'
                    : '')
                }
                fontSize={fontSize.toFixed(2)}
                fill={textFill}
                textAnchor={flipped ? 'end' : 'start'}
                dominantBaseline="middle"
              >
                {labels[index]}
              </text>
            )
          })}

          <circle cx={CX} cy={CY} r={R_SLICE_OUT + 4} className="prompt-wheel-rim" />
        </g>

        <g className="prompt-wheel-static">
          <circle cx={CX} cy={CY} r={R_HUB + 3} className="prompt-wheel-hub-shadow" />
          <circle
            cx={CX}
            cy={CY}
            r={R_HUB}
            className="prompt-wheel-hub"
            onClick={onSpin}
            style={{ cursor: onSpin ? 'pointer' : 'default' }}
          />
          <circle cx={CX} cy={CY} r={R_HUB_INNER} className="prompt-wheel-hub-inner" />
          <text
            x={CX}
            y={CY - 12}
            className="prompt-wheel-hub-label"
            textAnchor="middle"
            fontSize={hubLabelSize.toFixed(2)}
            onClick={onSpin}
            style={{ cursor: onSpin ? 'pointer' : 'default' }}
          >
            {category}
          </text>
          <text
            x={CX}
            y={CY + 16}
            className="prompt-wheel-hub-value"
            textAnchor="middle"
            fontSize={hubValueSize.toFixed(2)}
            onClick={onSpin}
            style={{ cursor: onSpin ? 'pointer' : 'default' }}
          >
            {hubText}
          </text>

          <g className="prompt-wheel-pointer">
            <path
              d="M 190 -6 L 210 -6 L 210 12 L 205 12 L 205 24 L 200 32 L 195 24 L 195 12 L 190 12 Z"
              className="prompt-wheel-pointer-body"
            />
            <circle cx="200" cy="6" r="3" className="prompt-wheel-pointer-stud" />
          </g>
        </g>
      </svg>
    </div>
  )
}
