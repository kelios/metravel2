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

export function shouldShowTravelScrollToTop(criticalChromeReady: boolean) {
  return criticalChromeReady
}

export function shouldShowTravelStickyActions(isMobile: boolean) {
  return isMobile
}
