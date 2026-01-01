import { useMemo } from 'react'
import { Platform } from 'react-native'

import {
  useTravelDetailsStyles,
  HEADER_OFFSET_DESKTOP,
  HEADER_OFFSET_MOBILE,
} from '@/components/travel/details/TravelDetailsStyles'

export interface UseTravelDetailsLayoutArgs {
  isMobile: boolean
  screenWidth: number
}

export interface UseTravelDetailsLayoutReturn {
  headerOffset: number
  contentHorizontalPadding: number
  sideMenuPlatformStyles: object
}

export function useTravelDetailsLayout({
  isMobile,
  screenWidth,
}: UseTravelDetailsLayoutArgs): UseTravelDetailsLayoutReturn {
  const styles = useTravelDetailsStyles()

  const headerOffset = useMemo(
    () => (isMobile ? HEADER_OFFSET_MOBILE : HEADER_OFFSET_DESKTOP),
    [isMobile]
  )

  const contentHorizontalPadding = useMemo(() => {
    // Mobile should use the full width with a compact, consistent gutter.
    if (isMobile) return 16
    if (screenWidth >= 1600) return 80
    if (screenWidth >= 1440) return 64
    if (screenWidth >= 1024) return 48
    if (screenWidth >= 768) return 32
    return 16
  }, [isMobile, screenWidth])

  const sideMenuPlatformStyles = useMemo(() => {
    if (Platform.OS === 'web') {
      return isMobile ? styles.sideMenuWebMobile : styles.sideMenuWebDesktop
    }
    return styles.sideMenuNative
  }, [isMobile, styles])

  return {
    headerOffset,
    contentHorizontalPadding,
    sideMenuPlatformStyles,
  }
}
