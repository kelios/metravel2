/**
 * Hook for swipe gesture detection on mobile
 * Provides natural touch interactions for sliders and carousels
 */

import { useCallback, useRef } from 'react'
import { GestureResponderEvent, PanResponder } from 'react-native'
import { triggerHaptic } from '@/utils/travelDetailsUIUX'

export interface SwipeGestureConfig {
  /** Minimum distance to trigger swipe (px) */
  threshold?: number
  /** Maximum time for swipe (ms) */
  maxDuration?: number
  /** Minimum velocity to trigger swipe (px/ms) */
  velocityThreshold?: number
  /** Enable haptic feedback */
  haptics?: boolean
  /** Direction constraints */
  direction?: 'horizontal' | 'vertical' | 'both'
}

export interface SwipeGestureHandlers {
  /** Called on swipe left */
  onSwipeLeft?: () => void
  /** Called on swipe right */
  onSwipeRight?: () => void
  /** Called on swipe up */
  onSwipeUp?: () => void
  /** Called on swipe down */
  onSwipeDown?: () => void
  /** Called on drag start */
  onDragStart?: (x: number, y: number) => void
  /** Called during drag */
  onDrag?: (deltaX: number, deltaY: number) => void
  /** Called on drag end */
  onDragEnd?: (deltaX: number, deltaY: number, velocity: number) => void
}

export interface UseSwipeGestureReturn {
  /** Pan responder handlers to spread on component */
  panHandlers: any
  /** Current drag position */
  dragPosition: { x: number; y: number }
  /** Whether currently dragging */
  isDragging: boolean
}

export function useSwipeGesture(
  handlers: SwipeGestureHandlers,
  config: SwipeGestureConfig = {}
): UseSwipeGestureReturn {
  const {
    threshold = 50,
    maxDuration = 300,
    haptics = true,
    direction = 'horizontal',
  } = config

  const startX = useRef(0)
  const startY = useRef(0)
  const startTime = useRef(0)
  const isDragging = useRef(false)
  const dragPosition = useRef({ x: 0, y: 0 })

  const detectSwipeDirection = useCallback(
    (deltaX: number, deltaY: number, duration: number) => {
      const absX = Math.abs(deltaX)
      const absY = Math.abs(deltaY)

      // Check if meets threshold
      const meetsDistanceThreshold =
        (direction === 'horizontal' && absX >= threshold) ||
        (direction === 'vertical' && absY >= threshold) ||
        (direction === 'both' && (absX >= threshold || absY >= threshold))

      const meetsDurationThreshold = duration <= maxDuration

      if (!meetsDistanceThreshold || !meetsDurationThreshold) {
        return null
      }

      // Determine primary direction
      if (direction === 'horizontal' || (direction === 'both' && absX > absY)) {
        if (deltaX > 0) {
          if (haptics) triggerHaptic('light')
          handlers.onSwipeRight?.()
          return 'right'
        } else {
          if (haptics) triggerHaptic('light')
          handlers.onSwipeLeft?.()
          return 'left'
        }
      }

      if (direction === 'vertical' || (direction === 'both' && absY > absX)) {
        if (deltaY > 0) {
          if (haptics) triggerHaptic('light')
          handlers.onSwipeDown?.()
          return 'down'
        } else {
          if (haptics) triggerHaptic('light')
          handlers.onSwipeUp?.()
          return 'up'
        }
      }

      return null
    },
    [threshold, maxDuration, direction, haptics, handlers]
  )

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond if moved significantly
        const moved = Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10
        return moved
      },

      onPanResponderGrant: (evt: GestureResponderEvent) => {
        startX.current = evt.nativeEvent.pageX
        startY.current = evt.nativeEvent.pageY
        startTime.current = Date.now()
        isDragging.current = true
        dragPosition.current = { x: 0, y: 0 }

        handlers.onDragStart?.(startX.current, startY.current)
      },

      onPanResponderMove: (evt: GestureResponderEvent, gestureState) => {
        const deltaX = gestureState.dx
        const deltaY = gestureState.dy

        dragPosition.current = { x: deltaX, y: deltaY }
        handlers.onDrag?.(deltaX, deltaY)
      },

      onPanResponderRelease: (evt: GestureResponderEvent, gestureState) => {
        const deltaX = gestureState.dx
        const deltaY = gestureState.dy
        const duration = Date.now() - startTime.current
        const velocity = Math.max(Math.abs(gestureState.vx), Math.abs(gestureState.vy))

        isDragging.current = false

        handlers.onDragEnd?.(deltaX, deltaY, velocity)
        detectSwipeDirection(deltaX, deltaY, duration)

        // Reset
        dragPosition.current = { x: 0, y: 0 }
      },

      onPanResponderTerminate: () => {
        isDragging.current = false
        dragPosition.current = { x: 0, y: 0 }
      },
    })
  ).current

  return {
    panHandlers: panResponder.panHandlers,
    dragPosition: dragPosition.current,
    isDragging: isDragging.current,
  }
}

/**
 * Simplified swipe hook for simple left/right swipes
 */
export function useSimpleSwipe(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  threshold: number = 50
): UseSwipeGestureReturn {
  return useSwipeGesture(
    { onSwipeLeft, onSwipeRight },
    { threshold, direction: 'horizontal' }
  )
}

/**
 * Hook for pull-to-refresh gesture
 */
export function usePullToRefresh(
  onRefresh: () => void | Promise<void>,
  threshold: number = 80
): UseSwipeGestureReturn & { isRefreshing: boolean } {
  const isRefreshing = useRef(false)

  const handleSwipeDown = useCallback(async () => {
    if (isRefreshing.current) return

    isRefreshing.current = true
    await triggerHaptic('success')

    try {
      await onRefresh()
    } finally {
      isRefreshing.current = false
    }
  }, [onRefresh])

  const gestureHook = useSwipeGesture(
    { onSwipeDown: handleSwipeDown },
    { threshold, direction: 'vertical' }
  )

  return {
    ...gestureHook,
    isRefreshing: isRefreshing.current,
  }
}

/**
 * Get optimized swipe config for sliders
 */
export function getSliderSwipeConfig(): SwipeGestureConfig {
  return {
    threshold: 30, // Lower threshold for sliders
    maxDuration: 500,
    velocityThreshold: 0.2,
    haptics: true,
    direction: 'horizontal',
  }
}
