import { useCallback, useRef, useState } from 'react'
import { Animated } from 'react-native'

export interface UseTravelDetailsScrollStateReturn {
  scrollY: Animated.Value
  contentHeight: number
  viewportHeight: number
  handleContentSizeChange: (_w: number, h: number) => void
  handleLayout: (e: any) => void
}

export function useTravelDetailsScrollState(): UseTravelDetailsScrollStateReturn {
  const scrollY = useRef(new Animated.Value(0)).current
  const [contentHeight, setContentHeight] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)

  const handleContentSizeChange = useCallback((_w: number, h: number) => {
    setContentHeight(h)
  }, [])

  const handleLayout = useCallback((e: any) => {
    setViewportHeight(e.nativeEvent.layout.height)
  }, [])

  return {
    scrollY,
    contentHeight,
    viewportHeight,
    handleContentSizeChange,
    handleLayout,
  }
}
