import type React from 'react'

/**
 * #2176: каркас списка маршрутов профиля занимает место карточек. До правки он
 * был собран отдельно от сетки (две плашки по 200 px с `marginTop: 16`), и в
 * момент ответа API список переезжал на 16 px вверх (прод 05.10.2026: CLS
 * 0,017 на 320, 0,029 на 390, 0,007 на 1280).
 *
 * Здесь — настоящий серверный рендер react-native-web: дефект жил в расхождении
 * двух разметок и снимком пропов не ловился.
 */
let createElement: typeof import('react').createElement
let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup
let StyleSheet: { getSheet: () => { textContent: string }; flatten: (style: unknown) => Record<string, unknown> }
let View: React.ComponentType<any>
let ProfileTravelGrid: React.ComponentType<any>
let ProfileTravelGridSkeleton: React.ComponentType<any>
let ProfileTravelListView: React.ComponentType<any>
let TravelListItemSkeleton: React.ComponentType<any>
let createProfileScreenStyles: (args: Record<string, unknown>) => Record<string, unknown>
let createTravelListItemStyles: (colors: unknown) => Record<string, unknown>
let TRAVEL_CARD_TITLE_MIN_HEIGHT: number
let TRAVEL_CARD_META_LINE_HEIGHT: number
let CARD_MEDIA_SLOT_RATIO: number
let colors: unknown

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  // Карточка тянет роутер, авторизацию и избранное; геометрию ячейки задаёт сетка, а не она.
  jest.doMock('@/components/listTravel/RenderTravelItem', () => {
    const react = require('react')
    const rn = require('react-native')
    return {
      __esModule: true,
      default: ({ item }: { item: { id: number } }) => react.createElement(rn.View, { testID: `card-${item.id}` }),
    }
  })
  jest.doMock('@shopify/flash-list', () => ({ FlashList: () => null }))
  ;({ createElement } = require('react'))
  // `.node`: браузерная сборка серверного рендера требует MessageChannel, которого нет в jsdom.
  ;({ renderToStaticMarkup } = require('react-dom/server.node'))
  ;({ StyleSheet, View } = require('react-native'))
  ;({ ProfileTravelGrid, ProfileTravelGridSkeleton } = require('@/components/screens/profile/ProfileTravelGrid'))
  ;({ ProfileTravelListView } = require('@/components/screens/profile/ProfileTravelListView'))
  ;({ createProfileScreenStyles } = require('@/components/screens/profile/profileScreen.styles'))
  TravelListItemSkeleton = require('@/components/listTravel/TravelListItemSkeleton').default
  ;({
    createTravelListItemStyles,
    TRAVEL_CARD_TITLE_MIN_HEIGHT,
    TRAVEL_CARD_META_LINE_HEIGHT,
  } = require('@/components/listTravel/travelListItemStyles'))
  ;({ CARD_MEDIA_SLOT_RATIO } = require('@/components/listTravel/travelListItemHelpers'))
  // Те же цвета, что получит каркас: иначе сверка рамки упёрлась бы в оттенок, а не в геометрию.
  const { useThemedColors } = require('@/hooks/useTheme')
  renderToStaticMarkup(
    createElement(() => {
      colors = useThemedColors()
      return null
    }),
  )
})

const toHost = (element: React.ReactElement): HTMLElement => {
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(element)
  return host
}

/** Узел `View` с данным стилем и без него — эталон для сверки. */
const reference = (style?: unknown): Element => toHost(createElement(View, { style })).firstElementChild!

/** Объявления всех атомарных классов узла — то, что реально применит браузер. */
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

/** Геометрия узла целиком: атомарные классы и инлайн-стиль. */
const geometryOf = (node: Element): string => `${declarationsOf(node)}|${node.getAttribute('style') ?? ''}`

const screenStyles = (gapSize: number) =>
  createProfileScreenStyles({
    colors: { background: '#ffffff' },
    contentPadding: 12,
    gapSize,
    isDesktopWeb: true,
    maxContentWidth: 1280,
  })

const travels = (count: number) => Array.from({ length: count }, (_, index) => ({ id: index + 1 }))

const GRIDS = [
  { name: 'одна колонка (телефон)', isCardsSingleColumn: true, gridColumns: 1, gapSize: 8, cols: 1 },
  { name: 'три колонки (desktop)', isCardsSingleColumn: false, gridColumns: 3, gapSize: 14, cols: 3 },
]

describe('каркас списка маршрутов профиля (#2176)', () => {
  describe.each(GRIDS)('$name', ({ isCardsSingleColumn, gridColumns, gapSize, cols }) => {
    const grid = { isCardsSingleColumn, gridColumns, gapSize }

    it('ряд и ячейка каркаса — те же, что у карточек', () => {
      const styles = screenStyles(gapSize)
      const skeletonRow = toHost(createElement(ProfileTravelGridSkeleton, { styles, ...grid })).firstElementChild!
      const cardsRow = toHost(
        createElement(
          View,
          null,
          createElement(ProfileTravelGrid, {
            styles,
            ...grid,
            currentData: travels(cols + 1),
            isMobileDevice: isCardsSingleColumn,
            userId: '1',
            isSuperuser: false,
            activeTab: 'travels',
            handleDeleteMyTravel: jest.fn(),
            width: 1280,
            removingTravelId: null,
          }),
        ),
      ).querySelector('[data-testid="card-1"]')!.parentElement!.parentElement!

      expect(skeletonRow.getAttribute('data-testid')).toBe('profile-travel-grid-skeleton')
      expect(geometryOf(skeletonRow)).toBe(geometryOf(cardsRow))

      const skeletonCells = Array.from(skeletonRow.children)
      // Один полный ряд: сколько маршрутов придёт, до ответа неизвестно.
      expect(skeletonCells).toHaveLength(cols)
      for (const cell of skeletonCells) {
        expect(geometryOf(cell)).toBe(geometryOf(cardsRow.children[0]))
        expect(cell.querySelector('[data-testid="travel-list-item-skeleton"]')).not.toBeNull()
      }
    })

    it('карточки встают на место каркаса: обёртка списка одна и без своего отступа', () => {
      const styles = screenStyles(gapSize)
      const render = (loading: boolean) =>
        toHost(
          createElement(ProfileTravelListView, {
            styles,
            colors,
            contentPaddingBottom: 32,
            listHeader: createElement(View, { testID: 'list-header' }),
            emptyStateProps: { icon: 'map', title: 'Пусто' },
            currentData: loading ? [] : travels(2),
            isSectionTab: false,
            isTravelsTabLoading: loading,
            activeTab: 'travels',
            travelsLoadingMore: false,
            ...grid,
            isMobileDevice: isCardsSingleColumn,
            userId: '1',
            isSuperuser: false,
            handleDeleteMyTravel: jest.fn(),
            width: 1280,
            removingTravelId: null,
            handleWebScroll: jest.fn(),
            handleWebLayout: jest.fn(),
            handleWebContentSizeChange: jest.fn(),
            renderItem: jest.fn(),
            refreshing: false,
            onRefresh: jest.fn(),
            worldMapGestureActive: false,
            handleListEndReached: jest.fn(),
          }),
        )

      const loadingList = render(true).querySelector('[data-testid="profile-travel-list"]')!
      const loadedList = render(false).querySelector('[data-testid="profile-travel-list"]')!

      expect(loadingList.querySelector('[data-testid="profile-travel-grid-skeleton"]')).not.toBeNull()
      expect(loadedList.querySelector('[data-testid="card-1"]')).not.toBeNull()

      // Тот же слот под шапкой: React переиспользует узел, и любое расхождение
      // геометрии обёртки браузер считает сдвигом списка.
      const indexOf = (node: Element) => Array.from(node.parentElement!.children).indexOf(node)
      expect(indexOf(loadingList)).toBe(indexOf(loadedList))
      expect(loadingList.previousElementSibling?.getAttribute('data-testid')).toBe('list-header')
      expect(geometryOf(loadingList)).toBe(geometryOf(loadedList))
      // Своей геометрии у обёртки нет вовсе — голый `View`: ни отступа, ни зазора.
      expect(geometryOf(loadingList)).toBe(geometryOf(reference()))
    })
  })

  describe('каркас карточки', () => {
    it('держит рамку и текстовый блок настоящей карточки', () => {
      const cardStyles = createTravelListItemStyles(colors)
      const skeleton = toHost(createElement(TravelListItemSkeleton)).firstElementChild!
      const [media, content] = Array.from(skeleton.children)
      const stack = content.firstElementChild!
      const [title, metaRow] = Array.from(stack.children)

      expect(declarationsOf(skeleton)).toBe(declarationsOf(reference(cardStyles.card)))
      expect(declarationsOf(content)).toBe(declarationsOf(reference(cardStyles.cardContentContainer)))
      expect(declarationsOf(stack)).toBe(declarationsOf(reference(cardStyles.contentStack)))
      expect(declarationsOf(metaRow)).toBe(declarationsOf(reference(cardStyles.metaRow)))
      expect(declarationsOf(metaRow.firstElementChild!)).toBe(declarationsOf(reference(cardStyles.metaBadgesRow)))

      // Медиа-слот — тот же квадрат, что у карточки каталога (#1487).
      expect(declarationsOf(media)).toContain(`aspect-ratio:${CARD_MEDIA_SLOT_RATIO};`)
      // Две строки заголовка и строка меты: высоты из того же источника, что стили карточки.
      expect(StyleSheet.flatten(cardStyles.titleInline).minHeight).toBe(TRAVEL_CARD_TITLE_MIN_HEIGHT)
      expect(declarationsOf(title)).toContain(`height:${TRAVEL_CARD_TITLE_MIN_HEIGHT}px;`)
      expect(declarationsOf(metaRow.firstElementChild!.firstElementChild!)).toContain(
        `height:${TRAVEL_CARD_META_LINE_HEIGHT}px;`,
      )
    })
  })
})
