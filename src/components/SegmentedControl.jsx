import { useCallback, useRef } from 'react'

export default function SegmentedControl({
  label,
  labelId,
  options,
  value,
  onChange,
  columns = 3,
  required = false,
  compact = false,
}) {
  const optionRefs = useRef([])

  const handleKeyDown = useCallback(
    (event, index) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
        return
      }

      event.preventDefault()
      const lastIndex = options.length - 1
      let nextIndex = index

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        nextIndex = index === lastIndex ? 0 : index + 1
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        nextIndex = index === 0 ? lastIndex : index - 1
      } else if (event.key === 'Home') {
        nextIndex = 0
      } else if (event.key === 'End') {
        nextIndex = lastIndex
      }

      onChange(options[nextIndex])
      optionRefs.current[nextIndex]?.focus()
    },
    [onChange, options],
  )

  return (
    <div className="form-group">
      <span
        id={labelId}
        className={`form-label ${required ? 'form-label--required' : ''}`}
      >
        {label}
      </span>
      <div
        className={`segmented-control segmented-control--cols-${columns}${compact ? ' segmented-control--compact' : ''}`}
        role="radiogroup"
        aria-labelledby={labelId}
      >
        {options.map((option, index) => (
          <button
            key={option}
            ref={(element) => {
              optionRefs.current[index] = element
            }}
            type="button"
            role="radio"
            aria-checked={value === option}
            tabIndex={value === option ? 0 : -1}
            className={`segmented-control-option ${value === option ? 'segmented-control-option--active' : ''}`}
            onClick={() => onChange(option)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
