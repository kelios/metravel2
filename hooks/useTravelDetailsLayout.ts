import { useMemo } from 'react'
import { Platform } from 'react-native'


import {
  useTravelDetailsShellStyles,
  HEADER_OFFSET_DESKTOP,
  HEADER_OFFSET_MOBILE,
} from '@/components/travel/details/TravelDetailsShellStyles'

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
  const styles = useTravelDetailsShellStyles()

  const headerOffset = useMemo(
    () => (isMobile ? HEADER_OFFSET_MOBILE : HEADER_OFFSET_DESKTOP),
    [isMobile]
  )

  const contentHorizontalPadding = useMemo(() => {
    // Mobile should use the full width with a compact, consistent gutter.
    if (isMobile) return screenWidth < 360 ? 6 : 10
    if (screenWidth >= 1600) return 48
    if (screenWidth >= 1440) return 40
    if (screenWidth >= 1024) return 28
    if (screenWidth >= 768) return 20
    return 16
  }, [isMobile, screenWidth])

  const sideMenuPlatformStyles = useMemo(() => {
    if (Platform.OS === 'web') {
      return isMobile ? styles.sideMenuWebMobile : styles.sideMenuWebDesktop
    }
    return styles.sideMenuNative
  }, [isMobile, styles])

  return useMemo(() => ({
    headerOffset,
    contentHorizontalPadding,
    sideMenuPlatformStyles,
  }), [headerOffset, contentHorizontalPadding, sideMenuPlatformStyles])
}
