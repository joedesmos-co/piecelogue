import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export default function FolderSelect({
  label = 'Add to folder',
  folders = [],
  value,
  onChange,
}) {
  const listboxId = useId()
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)

  const options = [
    { id: '', label: 'No folder' },
    ...folders.map((folder) => ({ id: folder.id, label: folder.name })),
  ]

  const selectedOption =
    options.find((option) => option.id === (value || '')) || options[0]

  useEffect(() => {
    if (!open) return undefined

    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function openMenu() {
    const triggerRect = triggerRef.current?.getBoundingClientRect()
    const spaceBelow = triggerRect
      ? window.innerHeight - triggerRect.bottom
      : Number.POSITIVE_INFINITY
    setOpenUpward(spaceBelow < 220)
    const selectedIndex = options.findIndex((option) => option.id === (value || ''))
    setHighlightIndex(selectedIndex >= 0 ? selectedIndex : 0)
    setOpen(true)
  }

  function selectOption(option) {
    onChange(option.id)
    setOpen(false)
    triggerRef.current?.focus()
  }

  function handleTriggerKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (open) {
        selectOption(options[highlightIndex])
      } else {
        openMenu()
      }
      return
    }

    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        openMenu()
      }
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightIndex((index) => (index + 1) % options.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightIndex((index) => (index - 1 + options.length) % options.length)
    } else if (event.key === 'Home') {
      event.preventDefault()
      setHighlightIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setHighlightIndex(options.length - 1)
    }
  }

  return (
    <div className="form-group folder-select" ref={rootRef}>
      <span id={`${listboxId}-label`} className="form-label">
        {label}
      </span>

      <button
        ref={triggerRef}
        type="button"
        className="folder-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${listboxId}-label`}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="folder-select-value">{selectedOption.label}</span>
        <ChevronDown
          size={18}
          className={`folder-select-chevron ${open ? 'folder-select-chevron--open' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          id={listboxId}
          className={`folder-select-menu ${openUpward ? 'folder-select-menu--up' : ''}`}
          role="listbox"
          aria-labelledby={`${listboxId}-label`}
        >
          {options.map((option, index) => (
            <li key={option.id || 'none'} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={option.id === (value || '')}
                className={`folder-select-option ${
                  index === highlightIndex ? 'folder-select-option--highlighted' : ''
                } ${option.id === (value || '') ? 'folder-select-option--selected' : ''}`}
                onMouseEnter={() => setHighlightIndex(index)}
                onClick={() => selectOption(option)}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
