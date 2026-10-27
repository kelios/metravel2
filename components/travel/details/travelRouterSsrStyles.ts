import { METRICS } from '@/constants/layout'
import { JOURNAL_FONT_FAMILY } from './TravelDetailsStyleFragments'

// CSS owns the loaded document's geometry before the browser width is available to React.
export const TRAVEL_ROUTER_SSR_STYLES = `
[data-router-ssr="travel"]{--mt-travel-hero-height:clamp(260px,56vh,520px)}
[data-router-ssr="travel"] [data-testid="travel-details-hero-slider-container"]{height:var(--mt-travel-hero-height)}
[data-router-ssr="travel"] [data-ssr-travel-content="true"]{padding-inline:6px!important;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",system-ui,sans-serif!important}
[data-router-ssr="travel"] [data-ssr-travel-sidebar="true"]{display:none!important}
[data-router-ssr="travel"] [data-testid="travel-details-title"]{font-size:28px!important}
@media(min-width:${METRICS.breakpoints.phone}px){[data-router-ssr="travel"] [data-ssr-travel-content="true"]{padding-inline:10px!important}}
@media(min-width:${METRICS.breakpoints.tablet}px){
  [data-router-ssr="travel"]{--mt-travel-hero-height:70vh}
  [data-router-ssr="travel"] [data-ssr-travel-content="true"]{padding-inline:20px!important;font-family:${JOURNAL_FONT_FAMILY}!important}
  [data-router-ssr="travel"] [data-testid="travel-details-title"]{font-size:34px!important}
  [data-router-ssr="travel"] [data-ssr-mobile-author="true"]{display:none!important}
}
@media(min-width:${METRICS.breakpoints.largeTablet}px){[data-router-ssr="travel"] [data-ssr-travel-content="true"]{padding-inline:28px!important}}
@media(min-width:${METRICS.breakpoints.desktop}px){[data-router-ssr="travel"] [data-ssr-travel-sidebar="true"]{display:flex!important;width:clamp(288px,24vw,412px)!important}}
@media(min-width:1440px){[data-router-ssr="travel"] [data-ssr-travel-content="true"]{padding-inline:40px!important}}
@media(min-width:1600px){[data-router-ssr="travel"] [data-ssr-travel-content="true"]{padding-inline:48px!important}}
`
