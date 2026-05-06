import { Platform } from 'react-native'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { METRICS } from '@/constants/layout'

type TravelSkeletonReadyCandidate = {
  gallery?: unknown[] | null
} | null | undefined

export function shouldShowTravelDetailsDesktopSidebar(isMobile: boolean, screenWidth: number) {
  return !isMobile && screenWidth >= METRICS.breakpoints.desktop
}

export function shouldShowTravelDetailsSkeletonOverlay(travel: unknown) {
  void travel
  return Platform.OS === 'web'
}

export function isTravelDetailsFirstScreenReady(
  travel: TravelSkeletonReadyCandidate,
  lcpLoaded: boolean,
) {
  if (!travel) return false

  const hasHeroMedia = Array.isArray(travel.gallery) && travel.gallery.length > 0

  return !hasHeroMedia || lcpLoaded
}

export function getTravelDetailsDesktopLayoutStyle() {
  return {
    width: '100%' as const,
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: DESIGN_TOKENS.spacing.md,
  }
}

export function getTravelDetailsDesktopSidebarContainerStyle(menuWidthNum: number) {
  return {
    width: menuWidthNum,
    flexShrink: 0,
    position: 'sticky' as const,
    top: 0,
    alignSelf: 'flex-start' as const,
    maxHeight: '100vh',
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
  } as any
}

export function getTravelDetailsDesktopContentColumnStyle() {
  return {
    flex: 1,
    minWidth: 0,
  }
}
