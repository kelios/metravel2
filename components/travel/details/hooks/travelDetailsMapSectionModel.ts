import { Platform } from 'react-native'
import { METRICS } from '@/constants/layout'

export function getTravelDetailsMapSectionFlags(params: {
  forceOpenKey: string | null
  mapOpenTrigger: number
  width: number
}) {
  return {
    isMobileWeb: Platform.OS === 'web' && params.width <= METRICS.breakpoints.tablet,
    shouldForceRenderExcursions: params.forceOpenKey === 'excursions',
    shouldForceRenderMap:
      params.forceOpenKey === 'map' ||
      params.forceOpenKey === 'points' ||
      params.mapOpenTrigger > 0,
  }
}

export function getTravelDetailsMapSectionResetState() {
  return {
    downloadingRouteId: null,
    highlightedPoint: null,
    mapOpenTrigger: 0,
    mapOpened: false,
    mapResizeTrigger: 0,
    weatherVisible: false,
  }
}
