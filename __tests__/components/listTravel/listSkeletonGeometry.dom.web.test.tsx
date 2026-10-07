import type React from 'react'

/**
 * #2253 (LIST-SKELETON-GEOMETRY-001): каркас списка маршрутов стоит в той же
 * сетке и из тех же стилей, что карточка, которая его заменит. До правки каталог
 * `/search` и блок «Рядом» рисовали каркас из своих чисел (медиа 220/180 px,
 * свои отступы): прод 05.10.2026 — каркас 370×314 против карточки 370×455 на
 * 390 и 398×314 против 398×483 на 1280.
 *
 * Настоящий серверный рендер react-native-web: сверяются атомарные классы и
 * инлайн-стиль узлов, то есть то, что применит браузер.
 */
let createElement: typeof import('react').createElement
let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup
let StyleSheet: { getSheet: () => { textContent: string } }
let View: React.ComponentType<any>
let RightColumnListStatus: React.ComponentType<any>
let useRightColumnStyles: (args: Record<string, unknown>) => { rowLayout: Record<string, any> }
let TravelTmlRound: React.ComponentType<any>
let TravelTmlRoundSkeleton: React.ComponentType<any>
let SidebarSectionSkeleton: typeof import('@/components/travel/TravelDetailSkeletons').SidebarSectionSkeleton
let TravelListItemSkeleton: typeof import('@/components/listTravel/TravelListItemSkeleton').default
let mockSidebarWidth = 390

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('@/hooks/useResponsive', () => ({ ...jest.requireActual('@/hooks/useResponsive'), useResponsiveWidth: () => mockSidebarWidth }))
  jest.doMock('expo-router', () => ({ router: { push: jest.fn() } }))
  // Место карточки в списке задаёт обёртка TravelTmlRound; содержимое карточки
  // (и его анимации) к сверке не относится.
  jest.doMock('@/components/ui/UnifiedTravelCard', () => {
    const react = require('react')
    const rn = require('react-native')
    return { __esModule: true, default: () => react.createElement(rn.View, { testID: 'card' }) }
  })
  // Рекомендации — ленивый чанк со своими карточками; каркас ряда от них не зависит.
  jest.doMock('@/components/listTravel/RightColumn.parts', () => ({ RecommendationsPlaceholder: () => null }))
  ;({ createElement } = require('react'))
  // `.node`: браузерная сборка серверного рендера требует MessageChannel, которого нет в jsdom.
  ;({ renderToStaticMarkup } = require('react-dom/server.node'))
  ;({ StyleSheet, View } = require('react-native'))
  RightColumnListStatus = require('@/components/listTravel/RightColumnListStatus').default
  ;({ useRightColumnStyles } = require('@/components/listTravel/useRightColumnStyles'))
  TravelTmlRound = require('@/components/travel/TravelTmlRound').default
  ;({ TravelTmlRoundSkeleton } = require('@/components/travel/TravelTmlRound'))
  ;({ SidebarSectionSkeleton } = require('@/components/travel/TravelDetailSkeletons'))
  TravelListItemSkeleton = require('@/components/listTravel/TravelListItemSkeleton').default
})

const toHost = (element: React.ReactElement): HTMLElement => {
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(element)
  return host
}

const reference = (style?: unknown): Element => toHost(createElement(View, { style })).firstElementChild!

const declarationsOf = (node: Element): string => {
  const sheet = StyleSheet.getSheet().textContent
  return Array.from(node.classList)
    .map((name) => {
      const match = sheet.match(new RegExp(`\\.${name}\\{([^}]*)\\}`))
      return match ? match[1] : ''
    })
    .sort()
    .join('')
}

const geometryOf = (node: Element): string => `${declarationsOf(node)}|${node.getAttribute('style') ?? ''}`
// RNW compiles StyleSheet.create rules into classes but emits factory plain
// styles through inline(). Both are actual SSR CSS channels, not fallbacks to
// guessed geometry. Inline longhand wins over the base Text font shorthand.
const effectiveCssValue = (node: Element, property: string): string =>
  (node as HTMLElement).style.getPropertyValue(property) || window.getComputedStyle(node).getPropertyValue(property)

const GRIDS = [
  { name: 'одна колонка (телефон)', isMobile: true, gridColumns: 1, count: 4, cols: 1 },
  { name: 'три колонки (desktop)', isMobile: false, gridColumns: 3, count: 6, cols: 3 },
]

describe('каркас каталога /search (#2253)', () => {
  describe.each(GRIDS)('$name', ({ isMobile, gridColumns, count, cols }) => {
    it('ряды, ячейки и зазор каркаса — те же, что у рядов карточек', () => {
      let rowLayout: Record<string, any> = {}
      const Probe = () => {
        ;({ rowLayout } = useRightColumnStyles({
          colors: { border: '#000', surface: '#fff', text: '#000' },
          cardSpacing: 16,
          contentPadding: 12,
          gridColumns,
          isMobile,
          isExport: false,
          isWebMobile: isMobile,
        }))
        return createElement(RightColumnListStatus, {
          shouldShowSkeleton: true,
          isRecommendationsVisible: false,
          showInitialLoading: true,
          isError: false,
          isOffline: false,
          refetch: jest.fn(),
          showEmptyState: false,
          getEmptyStateMessage: null,
          activeFiltersCount: 0,
          search: '',
          onClearAll: jest.fn(),
          setSearch: jest.fn(),
          initialSkeletonCount: count,
          recommendationsSkeletonStyle: null,
          rowLayout,
        })
      }
      const host = toHost(createElement(Probe))
      const nodes = Array.from(host.children)
      const rows = count / cols

      expect(rowLayout.cols).toBe(cols)
      // ряд, разделитель, ряд, ... — как у FlashList с ItemSeparatorComponent
      expect(nodes).toHaveLength(rows * 2 - 1)
      nodes.forEach((node, index) => {
        if (index % 2 === 1) {
          expect(geometryOf(node)).toBe(geometryOf(reference(rowLayout.rowSeparatorStyle)))
          return
        }
        const rowStyle = index === 0 ? rowLayout.firstRowStyle : rowLayout.rowStyle
        expect(geometryOf(node)).toBe(geometryOf(reference(rowStyle)))
        const cells = Array.from(node.children)
        expect(cells).toHaveLength(cols)
        for (const cell of cells) {
          expect(geometryOf(cell)).toBe(geometryOf(reference(rowLayout.itemWrapperStyle)))
          expect(cell.firstElementChild!.getAttribute('data-testid')).toBe('travel-list-item-skeleton')
        }
      })
    })
  })
})

describe('каркас карточки «Рядом» на телефоне (#2253)', () => {
  it('обёртка и рамка — те же, что у TravelTmlRound', () => {
    const travel = { id: 7, name: 'Маршрут', url: '/travels/route', travel_image_thumb_url: '' }
    const card = toHost(createElement(TravelTmlRound, { travel })).firstElementChild!
    const skeleton = toHost(createElement(TravelTmlRoundSkeleton)).firstElementChild!

    expect(skeleton.getAttribute('data-testid')).toBe('travel-tml-round-skeleton')
    // Обёртка фиксированной высоты задаёт место карточки в списке целиком.
    expect(declarationsOf(skeleton)).toBe(declarationsOf(card))
    expect(declarationsOf(skeleton)).toMatch(/height:\d+px;/)
  })
})


describe('actual web sidebar skeleton families (#2253 Near/Popular correction)', () => {
  it.each([0, 320, 390, 767, 768, 1280])('Near uses its actual width branch and Popular stays catalog at %s', width => {
    mockSidebarWidth = width
    const host = toHost(createElement(SidebarSectionSkeleton))
    const near = host.querySelector('[data-testid="travel-sidebar-near-skeleton"]')!
    const popular = host.querySelector('[data-testid="travel-sidebar-popular-skeleton"]')!
    const catalog = toHost(createElement(TravelListItemSkeleton)).firstElementChild!
    const popularCard = popular.querySelector('[data-testid="travel-list-item-skeleton"]')!
    expect(popularCard).not.toBeNull()
    expect(geometryOf(popularCard)).toBe(geometryOf(catalog))
    expect(popular.querySelector('[data-testid="travel-sidebar-round-card-skeleton"]')).toBeNull()
    const round = near.querySelector('[data-testid="travel-sidebar-round-card-skeleton"]')
    if (width < 768) {
      const realNearSkeleton = toHost(createElement(TravelTmlRoundSkeleton)).firstElementChild!
      expect(round).not.toBeNull()
      expect(geometryOf(round!)).toBe(geometryOf(realNearSkeleton))
      expect(declarationsOf(round!)).toContain('height:250px;')
      const media = (card: Element) => [card, ...card.querySelectorAll('*')].find(node => geometryOf(node).includes('height:170px'))!
      expect(media(round!)).toBeTruthy()
      expect(geometryOf(media(round!))).toBe(geometryOf(media(realNearSkeleton)))
      expect(near.querySelector('[data-testid="travel-list-item-skeleton"]')).toBeNull()
    } else {
      expect(round).toBeNull()
      const nearCatalog = near.querySelector('[data-testid="travel-list-item-skeleton"]')!
      expect(geometryOf(nearCatalog)).toBe(geometryOf(catalog))
    }
  })
})

describe('actual lightweight sidebar header typography (#2253)', () => {
  it.each([320, 390])('uses natural text wrapping and actual subtitle spacing at %s', width => {
    mockSidebarWidth = width
    const host = toHost(createElement(SidebarSectionSkeleton))
    for (const kind of ['near', 'popular']) {
      const title = host.querySelector(`[data-testid="travel-sidebar-${kind}-skeleton-title"]`)!
      const subtitle = host.querySelector(`[data-testid="travel-sidebar-${kind}-skeleton-subtitle"]`)!
      expect(title.textContent?.length).toBeGreaterThan(0)
      expect(subtitle.textContent?.length).toBeGreaterThan(0)
      expect(geometryOf(title)).toContain('line-height:26px;')
      expect(geometryOf(subtitle)).toContain('line-height:22px;')
      expect(geometryOf(subtitle)).toContain('margin-top:8px;')
      expect({
        titleFont: effectiveCssValue(title, 'font-size'),
        titleLine: effectiveCssValue(title, 'line-height'),
        subtitleFont: effectiveCssValue(subtitle, 'font-size'),
        subtitleLine: effectiveCssValue(subtitle, 'line-height'),
        subtitleMargin: effectiveCssValue(subtitle, 'margin-top'),
      }).toEqual({ titleFont: '20px', titleLine: '26px', subtitleFont: '14px', subtitleLine: '22px', subtitleMargin: '8px' })
      expect(geometryOf(subtitle)).not.toContain('height:18px;')
      expect(title.parentElement!.parentElement!.getAttribute('aria-hidden')).toBe('true')
      // JSDOM does not lay out font lines: runtime 320/390 must measure wrap.
      expect(subtitle.getAttribute('style') ?? '').not.toContain('white-space:nowrap')
    }
  })
})

// Native consumer branch keeps the pre-correction placeholder JSX and gaps.
it('keeps the original native Near/Popular skeleton structure', () => {
  const { Platform } = require('react-native')
  const originalOS = Platform.OS
  try {
    Platform.OS = 'ios'
    mockSidebarWidth = 390
    const host = toHost(createElement(SidebarSectionSkeleton))
    for (const kind of ['near', 'popular']) {
      const section = host.querySelector(`[data-testid="travel-sidebar-${kind}-skeleton"]`)!
      expect(section.children).toHaveLength(3)
      expect(host.querySelector(`[data-testid="travel-sidebar-${kind}-skeleton-title"]`)).toBeNull()
      expect(host.querySelector(`[data-testid="travel-sidebar-${kind}-skeleton-subtitle"]`)).toBeNull()
      expect(declarationsOf(section)).toContain('gap:12px;')
      expect(geometryOf(section.children[0])).toContain('height:26px;')
      expect(geometryOf(section.children[1])).toContain('height:18px;')
      expect(section.querySelector('[data-testid="travel-sidebar-round-card-skeleton"]')).not.toBeNull()
    }
  } finally { Platform.OS = originalOS }
})
