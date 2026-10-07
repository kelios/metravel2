import type React from 'react'

let createElement: typeof import('react').createElement
let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup
let StyleSheet: { getSheet: () => { textContent: string } }
let SearchPageSkeleton: typeof import('@/components/listTravel/SearchPageSkeleton').default
let RightColumnListStatus: typeof import('@/components/listTravel/RightColumnListStatus').default
let useRightColumnStyles: typeof import('@/components/listTravel/useRightColumnStyles').useRightColumnStyles
let getViewport: typeof import('@/components/listTravel/listTravelBaseModel').getListTravelViewportState
let colors: ReturnType<typeof import('@/constants/designSystem').getThemedColors>
let mockWidth = 390

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('@/hooks/useTheme', () => ({ useThemedColors: () => colors }))
  jest.doMock('@/hooks/useResponsive', () => ({ useResponsive: () => ({ width: mockWidth, isPhone: mockWidth < 768, isLargePhone: false, isTablet: mockWidth >= 768 && mockWidth < 1280, isDesktop: mockWidth >= 1280, isPortrait: true }) }))
  jest.doMock('@/components/listTravel/RightColumn.parts', () => ({ RecommendationsPlaceholder: () => null }))
  ;({ createElement } = require('react'))
  ;({ renderToStaticMarkup } = require('react-dom/server.node'))
  ;({ StyleSheet } = require('react-native'))
  colors = require('@/constants/designSystem').getThemedColors(false)
  SearchPageSkeleton = require('@/components/listTravel/SearchPageSkeleton').default
  RightColumnListStatus = require('@/components/listTravel/RightColumnListStatus').default
  ;({ useRightColumnStyles } = require('@/components/listTravel/useRightColumnStyles'))
  getViewport = require('@/components/listTravel/listTravelBaseModel').getListTravelViewportState
})

const render = (element: React.ReactElement) => {
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(element)
  return host
}
const geometry = (node: Element) => [...node.classList].map(name => StyleSheet.getSheet().textContent.match(new RegExp(`\\.${name}\\{([^}]*)\\}`))?.[1] || '').sort().join('') + (node.getAttribute('style') || '')

it.each([390, 1280])('route fallback uses the actual catalog row/cell geometry at width %s', width => {
  mockWidth = width
  const viewport = getViewport({ rawWidth: width, isPhone: width < 768, isLargePhone: false, isTabletSize: width >= 768 && width < 1280, isDesktopSize: width >= 1280, isPortrait: true })
  const LoadedListLoadingPhase = () => {
    const { rowLayout } = useRightColumnStyles({ colors, cardSpacing: viewport.gapSize, contentPadding: viewport.contentPadding, gridColumns: viewport.gridColumns, isMobile: viewport.isCardsSingleColumn, isExport: false, isWebMobile: viewport.isCardsSingleColumn, cardsGridStyle: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', alignItems: 'flex-start' } })
    return createElement(RightColumnListStatus, { shouldShowSkeleton: true, isRecommendationsVisible: false, showInitialLoading: true, isError: false, isOffline: false, refetch: () => undefined, showEmptyState: false, getEmptyStateMessage: null, activeFiltersCount: 0, search: '', onClearAll: () => undefined, setSearch: () => undefined, initialSkeletonCount: 4, recommendationsSkeletonStyle: null, rowLayout })
  }
  const fallback = render(createElement(SearchPageSkeleton))
  const realList = render(createElement(LoadedListLoadingPhase))
  const row = fallback.querySelector('[data-testid="search-page-skeleton-row-0"]')!
  const cell = fallback.querySelector('[data-testid="search-page-skeleton-row-0-item-0"]')!
  expect(geometry(row)).toContain('flex-direction:row')
  expect(geometry(cell)).toContain('width:')
  expect(geometry(row)).toBe(geometry(realList.firstElementChild!))
  expect(geometry(cell)).toBe(geometry(realList.firstElementChild!.firstElementChild!))
  expect(cell.querySelector('[data-testid="travel-list-item-skeleton"]')).not.toBeNull()
})

it('unknown SSR width is mobile and its responsive padding applies before hydration', () => {
  mockWidth = 0
  const host = render(createElement(SearchPageSkeleton))
  expect(host.querySelector('[data-search-skeleton-unknown="true"]')).not.toBeNull()
  expect(host.querySelector('[data-testid="search-skeleton"]')).toBeNull()
  expect(host.querySelectorAll('[data-testid="travel-list-item-skeleton"]')).toHaveLength(4)
  expect(host.querySelector('style')?.textContent).toContain('padding-left:10px!important')
  expect(host.querySelector('style')?.textContent).toContain('max-width:359.98px')
})
