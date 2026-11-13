import { METRICS } from '@/constants/layout'
import { JOURNAL_FONT_FAMILY } from './TravelDetailsStyleFragments'

// CSS owns every loaded web shell's geometry before React restores its width.
// This layout marker does not imply that a server loader supplied the travel.
const ROOT = '[data-travel-web-layout="true"]'
export const TRAVEL_WEB_LAYOUT_STYLES = `
${ROOT}{--mt-travel-hero-height:clamp(260px,56vh,520px)}
${ROOT} [data-testid="travel-details-hero-slider-container"]{height:var(--mt-travel-hero-height)}
${ROOT} [data-travel-web-content="true"]{padding-inline:6px!important;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",system-ui,sans-serif!important}
${ROOT} [data-travel-web-sidebar="true"]{display:none!important}
${ROOT} [data-testid="travel-details-title"]{font-size:28px!important}
@media(min-width:${METRICS.breakpoints.phone}px){${ROOT} [data-travel-web-content="true"]{padding-inline:10px!important}}
@media(min-width:${METRICS.breakpoints.tablet}px){
  ${ROOT}{--mt-travel-hero-height:70vh}
  ${ROOT} [data-travel-web-content="true"]{padding-inline:20px!important;font-family:${JOURNAL_FONT_FAMILY}!important}
  ${ROOT} [data-testid="travel-details-title"]{font-size:34px!important}
  ${ROOT} [data-travel-mobile-author="true"]{display:none!important}
}
@media(min-width:${METRICS.breakpoints.largeTablet}px){${ROOT} [data-travel-web-content="true"]{padding-inline:28px!important}}
@media(min-width:${METRICS.breakpoints.desktop}px){${ROOT} [data-travel-web-sidebar="true"]{display:flex!important;width:clamp(288px,24vw,412px)!important}}
@media(min-width:1440px){${ROOT} [data-travel-web-content="true"]{padding-inline:40px!important}}
@media(min-width:1600px){${ROOT} [data-travel-web-content="true"]{padding-inline:48px!important}}
`
