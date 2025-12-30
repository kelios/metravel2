import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { Animated } from 'react-native'

import { useScrollListener } from '@/hooks/useTravelDetailsUtils'

export interface UseTravelDetailsScrollStateArgs {
  isMobile: boolean
}

export interface UseTravelDetailsScrollStateReturn {
  scrollY: Animated.Value
  contentHeight: number
  viewportHeight: number
  showMobileSectionTabs: boolean
  heroBlockHeight: number
  setHeroBlockHeight: Dispatch<SetStateAction<number>>
  handleContentSizeChange: (_w: number, h: number) => void
  handleLayout: (e: any) => void
}

export function useTravelDetailsScrollState({
  isMobile,
}: UseTravelDetailsScrollStateArgs): UseTravelDetailsScrollStateReturn {
  const scrollY = useRef(new Animated.Value(0)).current
  const [contentHeight, setContentHeight] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const [showMobileSectionTabs, setShowMobileSectionTabs] = useState(false)
  const [heroBlockHeight, setHeroBlockHeight] = useState(0)

  const handleContentSizeChange = useCallback((_w: number, h: number) => {
    setContentHeight(h)
  }, [])

  const handleLayout = useCallback((e: any) => {
    setViewportHeight(e.nativeEvent.layout.height)
  }, [])

  useScrollListener(
    scrollY,
    (value) => {
      if (isMobile) {
        const threshold = Math.max(140, (heroBlockHeight || 0) - 24)
        const next = value > threshold
        setShowMobileSectionTabs((prev) => (prev === next ? prev : next))
      }
    },
    [isMobile, heroBlockHeight]
  )

  useEffect(() => {
    if (!isMobile) {
      if (showMobileSectionTabs) setShowMobileSectionTabs(false)
      return
    }
  }, [isMobile, showMobileSectionTabs])

  return {
    scrollY,
    contentHeight,
    viewportHeight,
    showMobileSectionTabs,
    heroBlockHeight,
    setHeroBlockHeight,
    handleContentSizeChange,
    handleLayout,
  }
}
