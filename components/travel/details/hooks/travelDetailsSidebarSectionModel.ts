import { Platform } from 'react-native'
import type { Travel } from '@/types/types'

export const TRAVEL_DETAILS_SIDEBAR_PROGRESSIVE_LOAD_CONFIG = {
  fallbackDelay: 1000,
  priority: 'low' as const,
  // Mirrors `TRAVEL_DEFERRED_RESERVED_SECTION_ROOT_MARGIN` in
  // `useTravelDeferredSectionsModel`, kept as a literal so this lazy sidebar
  // chunk does not pull the deferred-sections module in. Mounting the sidebar a
  // viewport early is pointless while the near/popular requests still wait for
  // the tight default margin (#1642).
  rootMargin: '200%',
  threshold: 0.1,
}

export function areSameTravelLists(prev: Travel[], next: Travel[]) {
  if (prev === next) return true
  if (prev.length !== next.length) return false

  for (let index = 0; index < prev.length; index += 1) {
    if (String(prev[index]?.id ?? '') !== String(next[index]?.id ?? '')) return false
  }

  return true
}

export function getTravelDetailsSidebarSectionFlags(params: {
  canRenderHeavy: boolean
  relatedTravels: Travel[]
  travelId: unknown
}) {
  const isWeb = Platform.OS === 'web'

  return {
    hasValidTravelId: Number.isFinite(Number(params.travelId)) && Number(params.travelId) > 0,
    progressiveEnabled: !isWeb || params.canRenderHeavy,
    shouldShowNavigationArrows: params.relatedTravels.length > 0,
  }
}
