import { Platform } from 'react-native'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { METRICS } from '@/constants/layout'
import type { GalleryItem, TravelMedia } from '@/types/types'
import {
  findGalleryMediaImage,
  getMediaPlaceholderData,
} from '@/utils/travelMediaVariants'

type TravelSkeletonReadyCandidate = {
  gallery?: GalleryItem[] | null
  media?: TravelMedia | null
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
  if (!hasHeroMedia) return true

  const firstGalleryImage = travel.gallery?.[0]
  const firstGalleryId = typeof firstGalleryImage === 'object'
    ? firstGalleryImage?.id
    : null
  const heroMedia = findGalleryMediaImage(travel.media, firstGalleryId)
  const placeholder = getMediaPlaceholderData(heroMedia)
  const hasLocalDataPlaceholder = Boolean(
    placeholder.blurhash || placeholder.dominantColor,
  )

  // A locally painted blurhash/dominant color is already a stable visual first
  // frame. Lift the page skeleton immediately so it cannot mask that frame while
  // the sharp hero is still downloading. URL-backed LQIP and legacy payloads
  // keep waiting for the real hero (with the existing timeout backstop).
  return lcpLoaded || hasLocalDataPlaceholder
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
    maxHeight:
      Platform.OS === 'web'
        ? 'calc(100dvh - var(--mt-dock-h, 0px) - 96px)'
        : '100%',
    overflowY: 'hidden' as const,
    overflowX: 'hidden' as const,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    minHeight: 0,
  } as any
}

export function getTravelDetailsDesktopContentColumnStyle() {
  return {
    flex: 1,
    minWidth: 0,
  }
}
