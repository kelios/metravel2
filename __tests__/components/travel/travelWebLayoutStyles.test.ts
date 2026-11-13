import { TRAVEL_WEB_LAYOUT_STYLES } from '@/components/travel/details/travelRouterSsrStyles'

const root = '[data-travel-web-layout="true"]'

it('gives generic and loader-backed web documents one CSS geometry owner', () => {
  expect(TRAVEL_WEB_LAYOUT_STYLES).not.toContain('data-router-ssr')
  expect(TRAVEL_WEB_LAYOUT_STYLES).toContain(`${root}{--mt-travel-hero-height:clamp(260px,56vh,520px);`)
  expect(TRAVEL_WEB_LAYOUT_STYLES).toContain(`${root} [data-testid="travel-details-hero-slider-container"]{height:var(--mt-travel-hero-height)}`)
  expect(TRAVEL_WEB_LAYOUT_STYLES).toContain(`${root} [data-travel-web-sidebar="true"]{display:none!important}`)
  expect(TRAVEL_WEB_LAYOUT_STYLES).toContain(`${root} [data-travel-web-content="true"]{padding-inline:var(--mt-travel-content-gutter)!important;`)
  expect(TRAVEL_WEB_LAYOUT_STYLES).toContain('--mt-travel-sidebar-width:clamp(288px,24vw,412px)')
})

it('retains the current desktop viewport height, gutters and CSS-controlled membership', () => {
  expect(TRAVEL_WEB_LAYOUT_STYLES).toContain(`@media(min-width:768px){
  ${root}{--mt-travel-hero-height:70vh;`)
  expect(TRAVEL_WEB_LAYOUT_STYLES).toContain(`${root} [data-travel-mobile-author="true"]{display:none!important}`)
  expect(TRAVEL_WEB_LAYOUT_STYLES).toContain(`@media(min-width:1024px){${root}{--mt-travel-content-gutter:28px}}`)
  expect(TRAVEL_WEB_LAYOUT_STYLES).toContain(`@media(min-width:1280px){${root} [data-travel-web-sidebar="true"]{display:flex!important;width:var(--mt-travel-sidebar-width)!important}}`)
})

it('uses the same gutter variable at every existing responsive boundary', () => {
  for (const [width, gutter] of [[360, 10], [768, 20], [1024, 28], [1440, 40], [1600, 48]]) {
    expect(TRAVEL_WEB_LAYOUT_STYLES).toMatch(new RegExp(`@media\\(min-width:${width}px\\)\\{\\s*\\[data-travel-web-layout="true"\\]\\{[^}]*--mt-travel-content-gutter:${gutter}px`))
  }
})

it('lets the standalone loading root inherit the loaded shell geometry and title metrics', () => {
  expect(TRAVEL_WEB_LAYOUT_STYLES).toContain(`${root}[data-travel-web-loading="true"]{width:100%;max-width:var(--mt-travel-layout-max-width);margin-inline:auto}`)
  expect(TRAVEL_WEB_LAYOUT_STYLES).toContain('height:calc(var(--mt-travel-title-font-size) * 1.25 * 2)')
  expect(TRAVEL_WEB_LAYOUT_STYLES).toContain('height:calc(var(--mt-travel-title-font-size) * 1.25)')
  expect(TRAVEL_WEB_LAYOUT_STYLES).toContain(`${root} [data-travel-loading-title-continuation="true"]{display:none}`)
})
