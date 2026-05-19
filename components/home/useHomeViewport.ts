import { useEffect, useMemo, useState } from 'react'
import { Platform, useWindowDimensions } from 'react-native'

import { METRICS } from '@/constants/layout'

const IS_WEB = Platform.OS === 'web'

export function useHomeViewport() {
  const { width: rawWidth, height: rawHeight } = useWindowDimensions()
  const [isHydrated, setIsHydrated] = useState(!IS_WEB)

  useEffect(() => {
    if (!IS_WEB) return
    setIsHydrated(true)
  }, [])

  const width = IS_WEB && !isHydrated ? 0 : rawWidth
  const height = IS_WEB && !isHydrated ? 0 : rawHeight

  const isSmallPhone = width > 0 && width < METRICS.breakpoints.phone
  const isPhone = width >= METRICS.breakpoints.phone && width < METRICS.breakpoints.largePhone
  const isLargePhone = width >= METRICS.breakpoints.largePhone && width < METRICS.breakpoints.tablet
  const isTablet = width >= METRICS.breakpoints.tablet && width < METRICS.breakpoints.largeTablet
  const isDesktop = width >= METRICS.breakpoints.desktop
  const isMobile = width > 0 && width < METRICS.breakpoints.tablet
  const isPortrait = height >= width

  return useMemo(
    () => ({
      height,
      isDesktop,
      isHydrated,
      isLargePhone,
      isMobile,
      isPhone,
      isPortrait,
      isSmallPhone,
      isTablet,
      width,
    }),
    [height, isDesktop, isHydrated, isLargePhone, isMobile, isPhone, isPortrait, isSmallPhone, isTablet, width],
  )
}

