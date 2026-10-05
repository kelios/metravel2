import { StyleSheet } from 'react-native'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { useQuery } from '@tanstack/react-query'
import { HomeInspirationSection } from '@/components/home/HomeInspirationSection'

const mockPush = jest.fn()

jest.mock('@tanstack/react-query')
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))
// Ширина вьюпорта решает раскладку секции; по умолчанию — телефон 390.
let mockViewport: { isPhone: boolean; isLargePhone: boolean; width: number } = {
  isPhone: true,
  isLargePhone: false,
  width: 390,
}

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ ...mockViewport }),
}))
jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    text: '#111111',
    textMuted: '#666666',
    brand: '#aa7744',
    primary: '#bb8844',
    primarySoft: '#f6eee6',
    primaryText: '#7a5723',
    primaryAlpha30: 'rgba(187, 136, 68, 0.3)',
    surface: '#ffffff',
    backgroundSecondary: '#faf8f5',
    borderLight: '#e5ded4',
  }),
}))
jest.mock('@/utils/analytics', () => ({
  sendAnalyticsEvent: jest.fn(),
}))
jest.mock('@/components/listTravel/RenderTravelItem', () => {
  const { Text } = require('react-native')

  return function MockRenderTravelItem({
    item,
  }: {
    item: { name?: string; id?: string | number }
  }) {
    return <Text>{item.name ?? item.id}</Text>
  }
})

const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>

describe('HomeInspirationSection mobile weekend showcase', () => {
  beforeEach(() => {
    mockViewport = { isPhone: true, isLargePhone: false, width: 390 }
    mockUseQuery.mockReturnValue({
      data: {
        results: [
          { id: 1, name: 'Маршрут 1' },
          { id: 2, name: 'Маршрут 2' },
          { id: 3, name: 'Маршрут 3' },
          { id: 4, name: 'Маршрут 4' },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // #2289: ровная сетка одинаковых карточек вместо зигзага 7/12+5/12 на
  // десктопе и шести карточек столбцом (блок 2941 px) на телефоне.
  describe('weekend showcase grid', () => {
    const renderShowcase = (width: number, count: number) => {
      mockViewport = { isPhone: width < 480, isLargePhone: width >= 480 && width < 768, width }
      mockUseQuery.mockReturnValue({
        data: {
          results: Array.from({ length: count }, (_, index) => ({
            id: index + 1,
            name: `Маршрут ${index + 1}`,
          })),
        },
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      } as any)

      return render(
        <HomeInspirationSection
          title="Идеи для ближайших выходных"
          subtitle="Реальные маршруты без долгого планирования"
          queryKey="home-travels-of-month"
          fetchFn={jest.fn()}
        />,
      )
    }

    const rowSizes = (view: ReturnType<typeof render>) =>
      view.getAllByTestId('home-showcase-row').map(
        (row) => row.findAll((node) => node.props.testID === 'home-showcase-cell', { deep: false }).length,
      )
    const cellStyles = (view: ReturnType<typeof render>) =>
      view.getAllByTestId('home-showcase-cell').map((cell) => StyleSheet.flatten(cell.props.style))

    it.each([
      [390, 6, [1, 1, 1]],
      [390, 2, [1, 1]],
      [768, 6, [2, 2]],
      [768, 3, [2]],
      [1440, 6, [3, 3]],
      [1440, 5, [3]],
      [1440, 2, [2]],
    ])('%ipx, %i маршрутов → ряды %j', (width, count, rows) => {
      const view = renderShowcase(width, count)
      expect(rowSizes(view)).toEqual(rows)
    })

    it('все ячейки одной ширины колонки, не растягиваются и ужимаются поровну', () => {
      for (const [width, basis] of [[390, '100%'], [768, '50%'], [1440, `${100 / 3}%`]] as const) {
        const view = renderShowcase(width, 6)
        for (const style of cellStyles(view)) {
          expect(style).toMatchObject({ flexBasis: basis, flexGrow: 0, flexShrink: 1, minWidth: 0 })
          expect(style.width).toBeUndefined()
        }
        view.unmount()
      }
    })

    it('неполный ряд стоит по центру шириной колонки', () => {
      const view = renderShowcase(1440, 2)
      const row = view.getByTestId('home-showcase-row')
      expect(StyleSheet.flatten(row.props.style)).toMatchObject({
        flexDirection: 'row',
        justifyContent: 'center',
      })
      expect(cellStyles(view).map((style) => style.flexBasis)).toEqual([`${100 / 3}%`, `${100 / 3}%`])
    })

    it('сетка не шире 1136 и по центру; в одну колонку — зазор 12 без сепараторов', () => {
      const desktop = renderShowcase(1440, 6)
      expect(StyleSheet.flatten(desktop.getByTestId('home-showcase-grid').props.style)).toMatchObject({
        width: '100%',
        maxWidth: 1136,
        alignSelf: 'center',
        gap: 16,
      })
      desktop.unmount()

      const phone = renderShowcase(390, 6)
      const grid = phone.getByTestId('home-showcase-grid')
      expect(StyleSheet.flatten(grid.props.style)).toMatchObject({ gap: 12 })
      // Прямые дети сетки — только ряды карточек, никаких View-сепараторов.
      const children = grid.children.map((child) => (typeof child === 'string' ? child : child.props.testID))
      expect(children).toEqual(['home-showcase-row', 'home-showcase-row', 'home-showcase-row'])
    })

    it('скелетон зеркалит сетку: те же ряды и число слотов', () => {
      mockViewport = { isPhone: false, isLargePhone: false, width: 1440 }
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: jest.fn(),
      } as any)
      const view = render(
        <HomeInspirationSection
          title="Идеи для ближайших выходных"
          queryKey="home-travels-of-month"
          fetchFn={jest.fn()}
        />,
      )
      expect(rowSizes(view)).toEqual([3, 3])
      expect(view.getAllByTestId('home-showcase-skeleton-slot')).toHaveLength(6)
    })
  })

  // #1414 (TestFlight 1.0.5 (8)): бейдж секции дублировал её же заголовок и
  // вместе с ним съедал экран до первой карточки. На телефоне он снят, на
  // широком экране остаётся — обе стороны контракта держим тестом.
  it('drops the section badge on a phone and keeps it on a wide viewport', () => {
    const section = (
      <HomeInspirationSection
        title="Идеи для ближайших выходных"
        subtitle="Реальные маршруты без долгого планирования"
        queryKey="home-travels-of-month"
        fetchFn={jest.fn()}
      />
    )

    const phone = render(section)
    expect(phone.queryByText('Подборка выходного дня')).toBeNull()
    expect(phone.getByText('Идеи для ближайших выходных')).toBeTruthy()
    phone.unmount()

    mockViewport = { isPhone: false, isLargePhone: false, width: 1280 }
    const wide = render(section)
    expect(wide.getByText('Подборка выходного дня')).toBeTruthy()
  })

  // #1778 (TestFlight 1.0.5 (8), «Слишком много популярных нам точно столько
  // нужно?»): на телефоне карточка рельсы занимает почти всю ширину, поэтому
  // восемь популярных — это восемь свайпов. Лимит подборки «Популярное» на
  // телефоне сокращён до пяти; остальные рельсы (например «Новые маршруты»)
  // остаются на общем лимите 8 — обе стороны контракта держим numeric-assert'ом.
  describe('rail card budget', () => {
    // Элементов заведомо больше любого лимита рельсы: иначе «десктоп рисует 10»
    // проходит и при снятом лимите, и assert перестаёт быть потолком.
    const RAIL_FIXTURE_SIZE = 12
    const railData = {
      results: Array.from({ length: RAIL_FIXTURE_SIZE }, (_, index) => ({
        id: index + 1,
        name: `Маршрут ${index + 1}`,
      })),
    }

    const renderRail = (queryKey: string) => {
      mockUseQuery.mockReturnValue({
        data: railData,
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      } as any)

      return render(
        <HomeInspirationSection
          title="Популярное у путешественников"
          subtitle="Маршруты, которые чаще всего открывают другие путешественники"
          queryKey={queryKey}
          fetchFn={jest.fn()}
          layout="rail"
        />,
      )
    }

    const countRenderedRoutes = (view: ReturnType<typeof render>) =>
      Array.from({ length: RAIL_FIXTURE_SIZE }, (_, index) => index + 1).filter(
        (n) => view.queryByText(`Маршрут ${n}`) !== null,
      )

    it('caps the popular rail at 5 cards on a phone', () => {
      const view = renderRail('home-popular-travels')

      expect(countRenderedRoutes(view)).toEqual([1, 2, 3, 4, 5])
    })

    it('keeps other rails at 8 cards on a phone', () => {
      const view = renderRail('home-new-travels')

      expect(countRenderedRoutes(view)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    })

    it('keeps the popular rail at the full desktop budget of 10 cards', () => {
      mockViewport = { isPhone: false, isLargePhone: false, width: 1280 }
      const view = renderRail('home-popular-travels')

      expect(countRenderedRoutes(view)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    })
  })

  it('shows a working "Все маршруты" CTA that navigates to the catalog', () => {
    render(
      <HomeInspirationSection
        title="Идеи для ближайших выходных"
        subtitle="Реальные маршруты без долгого планирования"
        queryKey="home-travels-of-month"
        fetchFn={jest.fn()}
      />,
    )

    fireEvent.press(screen.getByText('Все маршруты'))
    expect(mockPush).toHaveBeenCalledWith('/search')
  })
})
