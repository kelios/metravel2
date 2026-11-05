import { startTransition, useCallback, useMemo, useRef, useState } from 'react'
import { Animated, Platform, type LayoutChangeEvent } from 'react-native'

export interface UseTravelDetailsScrollStateReturn {
  scrollY: Animated.Value
  contentHeight: number
  viewportHeight: number
  handleContentSizeChange: (_w: number, h: number) => void
  handleLayout: (e: LayoutChangeEvent) => void
}

export function useTravelDetailsScrollState(): UseTravelDetailsScrollStateReturn {
  const scrollY = useRef(new Animated.Value(0)).current
  const [contentHeight, setContentHeight] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)

  const handleContentSizeChange = useCallback((_w: number, h: number) => {
    // Size-derived chrome can wait for an interruptible web render; the actual
    // scroll position and native layout handling keep their existing urgency.
    if (Platform.OS === 'web') startTransition(() => setContentHeight(h))
    else setContentHeight(h)
  }, [])

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const height = e.nativeEvent.layout.height
    if (Platform.OS === 'web') startTransition(() => setViewportHeight(height))
    else setViewportHeight(height)
  }, [])

  return useMemo(() => ({
    scrollY,
    contentHeight,
    viewportHeight,
    handleContentSizeChange,
    handleLayout,
  }), [scrollY, contentHeight, viewportHeight, handleContentSizeChange, handleLayout])
}
