import { METRICS } from '@/constants/layout'

export function shouldShowTravelReadingProgress(params: {
  contentHeight: number
  criticalChromeReady: boolean
  viewportHeight: number
}) {
  return params.criticalChromeReady && params.contentHeight > params.viewportHeight
}

export function shouldShowTravelSectionsSheet(params: {
  criticalChromeReady: boolean
  screenWidth: number
  sectionLinks: any[]
}) {
  return (
    params.criticalChromeReady &&
    params.screenWidth < METRICS.breakpoints.largeTablet &&
    params.sectionLinks.length > 0
  )
}

/**
 * #2118: где монтируются слои рантайм-хрома детали. На native хром окна (бар
 * действий, прогресс) живёт вне ScrollView — в `viewportOverlay` оболочки; в
 * контенте только слой `scroll`. Web держит окно порталом и `fixed` — всё в контенте.
 */
export function getTravelDetailsRuntimeLayers(platformOS: string): {
  content: 'all' | 'scroll'
  viewportOverlay: boolean
} {
  return platformOS === 'web'
    ? { content: 'all', viewportOverlay: false }
    : { content: 'scroll', viewportOverlay: true }
}

export function shouldShowTravelStickyActions(isMobile: boolean) {
  return isMobile
}
