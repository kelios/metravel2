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

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
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
