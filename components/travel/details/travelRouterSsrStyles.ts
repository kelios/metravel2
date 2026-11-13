import { METRICS } from '@/constants/layout'
import { JOURNAL_FONT_FAMILY } from './TravelDetailsStyleFragments'
import { TRAVEL_FIRST_SCREEN } from './travelFirstScreenLayout'

// CSS owns pending and loaded web geometry before React restores its width.
// This layout marker does not imply that a server loader supplied the travel.
const ROOT = '[data-travel-web-layout="true"]'
export const TRAVEL_WEB_LAYOUT_STYLES = `
${ROOT}{--mt-travel-hero-height:clamp(260px,56vh,520px);--mt-travel-sidebar-width:clamp(288px,24vw,412px);--mt-travel-content-gutter:6px;--mt-travel-title-font-size:${TRAVEL_FIRST_SCREEN.titleFontSizePx}px;--mt-travel-layout-max-width:1600px}
${ROOT} [data-testid="travel-details-hero-slider-container"]{height:var(--mt-travel-hero-height)}
${ROOT} [data-travel-web-content="true"]{padding-inline:var(--mt-travel-content-gutter)!important;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",system-ui,sans-serif!important}
${ROOT} [data-travel-web-sidebar="true"]{display:none!important}
${ROOT} [data-testid="travel-details-title"]{font-size:var(--mt-travel-title-font-size)!important}
${ROOT}[data-travel-web-loading="true"]{width:100%;max-width:var(--mt-travel-layout-max-width);margin-inline:auto}
${ROOT} [data-travel-loading-title="true"]{display:flex;flex-direction:column;justify-content:space-around;height:calc(var(--mt-travel-title-font-size) * ${TRAVEL_FIRST_SCREEN.titleLineHeight} * ${TRAVEL_FIRST_SCREEN.titleReserveLines})}
@media(min-width:${METRICS.breakpoints.phone}px){${ROOT}{--mt-travel-content-gutter:10px}}
@media(min-width:${METRICS.breakpoints.tablet}px){
  ${ROOT}{--mt-travel-hero-height:70vh;--mt-travel-content-gutter:20px;--mt-travel-title-font-size:34px}
  ${ROOT} [data-travel-web-content="true"]{font-family:${JOURNAL_FONT_FAMILY}!important}
  ${ROOT} [data-travel-loading-title="true"]{height:calc(var(--mt-travel-title-font-size) * ${TRAVEL_FIRST_SCREEN.titleLineHeight})}
  ${ROOT} [data-travel-loading-title-continuation="true"]{display:none}
  ${ROOT} [data-travel-mobile-author="true"]{display:none!important}
}
@media(min-width:${METRICS.breakpoints.largeTablet}px){${ROOT}{--mt-travel-content-gutter:28px}}
@media(min-width:${METRICS.breakpoints.desktop}px){${ROOT} [data-travel-web-sidebar="true"]{display:flex!important;width:var(--mt-travel-sidebar-width)!important}}
@media(min-width:1440px){${ROOT}{--mt-travel-content-gutter:40px}}
@media(min-width:1600px){${ROOT}{--mt-travel-content-gutter:48px}}
`
