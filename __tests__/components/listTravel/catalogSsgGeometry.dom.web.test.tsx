let createElement: typeof import('react').createElement
let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup
let StyleSheet: typeof import('react-native').StyleSheet
let Skeleton: typeof import('@/components/listTravel/TravelListItemSkeleton').default
let createStyles: typeof import('@/components/listTravel/travelListItemStyles').createTravelListItemStyles
let viewport: typeof import('@/components/listTravel/listTravelBaseModel').getListTravelViewportState
let colors: ReturnType<typeof import('@/constants/designSystem').getThemedColors>
const geometry = require('@/components/listTravel/travelCatalogGeometry') as typeof import('@/components/listTravel/travelCatalogGeometry')
const { buildCatalogSkeletonCSS, buildSkeletonCSS, buildSearchSkeletonHtml } = require('../../../scripts/ssg-skeletons')

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('@/hooks/useTheme', () => ({ useThemedColors: () => colors }))
  ;({createElement} = require('react'))
  ;({renderToStaticMarkup} = require('react-dom/server.node'))
  ;({StyleSheet} = require('react-native'))
  colors = require('@/constants/designSystem').getThemedColors(false)
  Skeleton = require('@/components/listTravel/TravelListItemSkeleton').default
  createStyles = require('@/components/listTravel/travelListItemStyles').createTravelListItemStyles
  viewport = require('@/components/listTravel/listTravelBaseModel').getListTravelViewportState
})

const rule = (css: string, selector: string) => css.match(new RegExp(`${selector.replaceAll('.', '\\.')}\\{([^}]+)\\}`))![1]

it('Node SSG card consumes the actual RN card body styles and real skeleton media ratio', () => {
  const styles = createStyles(colors)
  const css = buildSkeletonCSS()
  const body = rule(css, '.ssg-search-card-body')
  expect(body).toContain(`padding:${styles.cardContentContainer.paddingTop}px ${styles.cardContentContainer.paddingHorizontal}px ${styles.cardContentContainer.paddingBottom}px`)
  expect(body).toContain(`gap:${styles.contentStack.gap}px`)
  expect(body).toContain(`border-top:${styles.cardContentContainer.borderTopWidth}px`)
  expect(rule(css, '.ssg-search-card-title')).toContain(`height:${styles.titleInline.minHeight}px`)
  expect(rule(css, '.ssg-search-card')).toContain(`border:${styles.card.borderWidth}px`)
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(createElement(Skeleton))
  const media = host.firstElementChild!.firstElementChild!
  const sheet = (StyleSheet as unknown as {getSheet():{textContent:string}}).getSheet().textContent
  const declarations = [...media.classList].map(name => rule(sheet, '.' + name)).join('') + (media.getAttribute('style') ?? '')
  expect(declarations).toContain('aspect-ratio:1')
  expect(rule(css, '.ssg-search-card-media')).toContain('aspect-ratio:1')
  expect(host.querySelector('[data-testid="travel-list-item-skeleton"]')).not.toBeNull()
  const ssg = document.createElement('div')
  ssg.innerHTML = buildSearchSkeletonHtml()
  expect(ssg.querySelector('.ssg-search-card-title')!.children).toHaveLength(2)
  expect(ssg.querySelector('.ssg-search-card-meta')!.children).toHaveLength(1)
})

it.each([320, 390, 767, 768, 1023, 1024, 1180, 1280, 1439, 1440, 1920, 2560])('preserves runtime grid rules and emits them for both orientations at %s', width => {
  for (const isPortrait of [true, false]) {
    const runtime = viewport({rawWidth:width, isPortrait, isPhone:width < 768, isLargePhone:false, isTabletSize:width >= 768 && width < 1280, isDesktopSize:width >= 1280})
    const model = geometry.getCatalogViewportGeometry({width, isPortrait})
    expect(runtime).toMatchObject(model)
    const css = buildCatalogSkeletonCSS()
    const rules = [...css.matchAll(/@media\(min-width:(\d+)px\) and \(orientation:(portrait|landscape)\)\{\.ssg-search-grid\{([^}]+)\}\.ssg-search-header\{([^}]+)\}\}/g)]
      .filter(match => Number(match[1]) <= width && match[2] === (isPortrait ? 'portrait':'landscape'))
    const applied = rules.at(-1)!
    expect(applied[3]).toContain(`repeat(${runtime.gridColumns},minmax(0,1fr))`)
    expect(applied[3]).toContain(`gap:${runtime.gapSize}px`)
    expect(applied[3]).toContain(`padding-left:${runtime.contentPadding}px`)
  }
})

it.each([
  [390, 1, 8, 10, 0], [768, 2, 12, 12, 0], [1024, 3, 14, 14, 0],
  [1280, 3, 14, 14, 0], [1440, 3, 14, 14, 288], [2560, 4, 16, 20, 340],
])('keeps the pre-extraction landscape catalog at %s', (width, columns, gap, padding, sidebar) => {
  expect(geometry.getCatalogViewportGeometry({width})).toMatchObject({gridColumns:columns, gapSize:gap, contentPadding:padding, sidebarWidth:sidebar})
})

it('first-frame chrome matches canonical header bands and actual search/list producers', () => {
  const {HEADER_HEIGHT_FALLBACK, HEADER_LAYOUT_BREAKPOINTS} = require('@/components/layout/headerLayoutContract')
  const {getRightColumnHeaderMinHeight} = require('@/components/listTravel/rightColumnModel')
  const {createListTravelBaseStyles} = require('@/components/listTravel/ListTravelBase.styles')
  const {useStickySearchBarStyles} = require('@/components/mainPage/StickySearchBar.styles')
  let searchStyles: ReturnType<typeof useStickySearchBarStyles>
  function Probe() {
    searchStyles = useStickySearchBarStyles(colors)
    return null
  }
  renderToStaticMarkup(createElement(Probe))
  const c = geometry.CATALOG_CHROME_GEOMETRY
  expect(c.brandCompactHeight).toBe(HEADER_HEIGHT_FALLBACK['compact-nobar'])
  expect(c.brandWideHeight).toBe(HEADER_HEIGHT_FALLBACK['wide-nobar'])
  expect(c.brandWideBreakpoint).toBe(HEADER_LAYOUT_BREAKPOINTS.compactRow)
  expect(c.headerMinMobile).toBe(getRightColumnHeaderMinHeight(true))
  expect(c.headerMinDesktop).toBe(getRightColumnHeaderMinHeight(false))
  expect(c.rightColumnPaddingTop).toBe(createListTravelBaseStyles(colors).rightColumn.paddingTop)
  expect(c.compactSearchHeight).toBe(searchStyles!.actionButtonMobileWeb.height + searchStyles!.containerMobileWeb.paddingVertical * 2 + searchStyles!.container.borderWidth * 2)
  expect(c.wideSearchHeight).toBe(searchStyles!.actionButton.height + searchStyles!.container.paddingVertical * 2 + searchStyles!.container.borderWidth * 2)
})
