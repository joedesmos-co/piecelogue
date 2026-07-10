import { useCallback, useRef } from 'react'

const DEFAULT_DELAY_MS = 520
const DEFAULT_MOVE_THRESHOLD = 12

function triggerHaptic() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(10)
  }
}

export function useLongPress({
  onPress,
  onLongPress,
  onLongPressMove,
  onLongPressEnd,
  delay = DEFAULT_DELAY_MS,
  moveThreshold = DEFAULT_MOVE_THRESHOLD,
  disabled = false,
}) {
  const timerRef = useRef(null)
  const startRef = useRef(null)
  const longPressActiveRef = useRef(false)
  const dragActiveRef = useRef(false)
  const movedRef = useRef(false)
  const pointerIdRef = useRef(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    clearTimer()
    startRef.current = null
    longPressActiveRef.current = false
    dragActiveRef.current = false
    movedRef.current = false
    pointerIdRef.current = null
  }, [clearTimer])

  const handlePointerDown = useCallback(
    (event) => {
      if (disabled || event.button > 0) {
        return
      }

      clearTimer()
      startRef.current = { x: event.clientX, y: event.clientY }
      movedRef.current = false
      longPressActiveRef.current = false
      dragActiveRef.current = false
      pointerIdRef.current = event.pointerId

      timerRef.current = setTimeout(() => {
        longPressActiveRef.current = true
        triggerHaptic()
        onLongPress?.(event)
      }, delay)
    },
    [clearTimer, delay, disabled, onLongPress],
  )

  const handlePointerMove = useCallback(
    (event) => {
      if (disabled || pointerIdRef.current !== event.pointerId || !startRef.current) {
        return
      }

      const deltaX = event.clientX - startRef.current.x
      const deltaY = event.clientY - startRef.current.y
      const distance = Math.hypot(deltaX, deltaY)

      if (!longPressActiveRef.current && distance > moveThreshold) {
        movedRef.current = true
        clearTimer()
        return
      }

      if (longPressActiveRef.current && distance > moveThreshold) {
        if (!dragActiveRef.current) {
          dragActiveRef.current = true
        }
        movedRef.current = true
        onLongPressMove?.(event, { deltaX, deltaY })
      }
    },
    [clearTimer, disabled, moveThreshold, onLongPressMove],
  )

  const handlePointerUp = useCallback(
    (event) => {
      if (disabled || pointerIdRef.current !== event.pointerId) {
        return
      }

      clearTimer()

      if (dragActiveRef.current) {
        onLongPressEnd?.(event, { cancelled: false, dragged: true })
      } else if (longPressActiveRef.current && !movedRef.current) {
        onLongPressEnd?.(event, { cancelled: false, dragged: false, showActions: true })
      } else if (!longPressActiveRef.current && !movedRef.current) {
        onPress?.(event)
      } else {
        onLongPressEnd?.(event, { cancelled: true, dragged: false })
      }

      reset()
    },
    [clearTimer, disabled, onLongPressEnd, onPress, reset],
  )

  const handlePointerCancel = useCallback(
    (event) => {
      if (disabled || pointerIdRef.current !== event.pointerId) {
        return
      }

      clearTimer()
      onLongPressEnd?.(event, { cancelled: true, dragged: dragActiveRef.current })
      reset()
    },
    [clearTimer, disabled, onLongPressEnd, reset],
  )

  return {
    longPressHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
  }
}
