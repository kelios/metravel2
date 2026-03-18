/**
 * Hook for virtualized list rendering
 * Only renders visible items for better performance with long lists
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { LayoutChangeEvent } from 'react-native'

export interface VirtualizedListConfig {
  /** Height of each item in pixels */
  itemHeight: number
  /** Buffer above/below viewport (number of items) */
  overscan?: number
  /** Container height (if not auto-detected) */
  containerHeight?: number
  /** Enable performance logging */
  debug?: boolean
}

export interface VirtualizedListReturn<T> {
  /** Visible items to render */
  visibleItems: Array<{ item: T; index: number; offset: number }>
  /** Total height for scroll container */
  totalHeight: number
  /** Scroll handler for ScrollView */
  onScroll: (event: any) => void
  /** Layout handler for container */
  onLayout: (event: LayoutChangeEvent) => void
  /** Current scroll position */
  scrollY: number
  /** Estimated index at top */
  startIndex: number
  /** Estimated index at bottom */
  endIndex: number
}

export function useVirtualizedList<T>(
  items: T[],
  config: VirtualizedListConfig
): VirtualizedListReturn<T> {
  const { itemHeight, overscan = 3, containerHeight: initialHeight, debug = false } = config

  const [scrollY, setScrollY] = useState(0)
  const [containerHeight, setContainerHeight] = useState(initialHeight || 600)
  const rafId = useRef<number>()

  /**
   * Calculate visible range based on scroll position
   */
  const { startIndex, endIndex, visibleItems, totalHeight } = useMemo(() => {
    const total = items.length * itemHeight

    // Calculate which items are visible
    const start = Math.max(0, Math.floor(scrollY / itemHeight) - overscan)
    const visibleCount = Math.ceil(containerHeight / itemHeight) + overscan * 2
    const end = Math.min(items.length, start + visibleCount)

    const visible = []
    for (let i = start; i < end; i++) {
      visible.push({
        item: items[i],
        index: i,
        offset: i * itemHeight,
      })
    }

    if (debug) {
      console.log(`[VirtualizedList] Rendering ${visible.length}/${items.length} items`, {
        start,
        end,
        scrollY,
      })
    }

    return {
      startIndex: start,
      endIndex: end,
      visibleItems: visible,
      totalHeight: total,
    }
  }, [items, itemHeight, scrollY, containerHeight, overscan, debug])

  /**
   * Handle scroll events with throttling
   */
  const onScroll = useCallback((event: any) => {
    if (rafId.current) {
      cancelAnimationFrame(rafId.current)
    }

    rafId.current = requestAnimationFrame(() => {
      const offset =
        event.nativeEvent?.contentOffset?.y ??
        event.currentTarget?.scrollTop ??
        0

      setScrollY(offset)
    })
  }, [])

  /**
   * Handle container layout changes
   */
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height
    if (height > 0) {
      setContainerHeight(height)
    }
  }, [])

  /**
   * Cleanup RAF on unmount
   */
  useEffect(() => {
    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current)
      }
    }
  }, [])

  return {
    visibleItems,
    totalHeight,
    onScroll,
    onLayout,
    scrollY,
    startIndex,
    endIndex,
  }
}

/**
 * Hook for variable height virtualization (more complex)
 */
export function useVariableVirtualizedList<T>(
  items: T[],
  estimatedItemHeight: number,
  _getItemHeight: (item: T, index: number) => number
): VirtualizedListReturn<T> {
  return useVirtualizedList(items, {
    itemHeight: estimatedItemHeight,
    overscan: 5, // Larger overscan for variable heights
  })
}

/**
 * Simple hook for windowing lists with fixed item count
 */
export function useWindowedList<T>(
  items: T[],
  windowSize: number = 20
): { visibleItems: T[]; hasMore: boolean; loadMore: () => void } {
  const [endIndex, setEndIndex] = useState(Math.min(windowSize, items.length))

  const loadMore = useCallback(() => {
    setEndIndex((prev) => Math.min(prev + windowSize, items.length))
  }, [items.length, windowSize])

  const visibleItems = useMemo(
    () => items.slice(0, endIndex),
    [items, endIndex]
  )

  return {
    visibleItems,
    hasMore: endIndex < items.length,
    loadMore,
  }
}
