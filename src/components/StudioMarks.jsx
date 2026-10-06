// Small, reusable ink marks. They are decoration, never interactive content.
export function BrushMark({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 400 42"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 34C55 12 129 9 190 9L151 23C206 15 253 5 286 8L259 27 392 23 304 32 227 36 255 18 127 30 154 17C97 18 47 25 4 38Z"
        fill="currentColor"
      />
      <path
        d="m12 31 63-13M280 34l95-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function SketchArrow({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 84 60"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 7C12 38 41 47 72 36M59 27l17 8-12 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
