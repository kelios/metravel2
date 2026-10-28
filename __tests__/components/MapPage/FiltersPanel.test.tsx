import React from 'react'
import { render, fireEvent, waitFor, within } from '@testing-library/react-native'
import FiltersPanel from '@/components/MapPage/FiltersPanel'
import { MapMobileLayersPopover } from '@/components/MapPage/MapMobile/MapMobileLayersPopover'
import { getThemedColors, ThemeProvider } from '@/hooks/useTheme'
import { FiltersProvider } from '@/context/MapFiltersContext'
import type { RoutePoint } from '@/types/route'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native')
  return {
    ...RN,
    useWindowDimensions: () => ({ width: 1024, height: 768 }),
    Platform: { OS: 'web', select: jest.fn((obj) => obj.web || obj.default) },
  }
})

const mockFilters = {
  categories: [
    { id: 1, name: 'Музеи' },
    { id: 2, name: 'Парки' },
  ],
  categoryTravelAddress: [
    { id: 1, name: 'Музеи' },
    { id: 2, name: 'Парки' },
  ],
  radius: [
    { id: '60', name: '60' },
    { id: '100', name: '100' },
  ],
  address: '',
}

const mockFilterValue = {
  categories: [],
  categoryTravelAddress: [],
  radius: '60',
  address: '',
  searchQuery: '',
}

const makePoint = (
  id: string,
  lat: number,
  lng: number,
  type: RoutePoint['type']
): RoutePoint => ({
  id,
  coordinates: { lat, lng },
  address: '',
  type,
  timestamp: Date.now(),
})

const defaultProps = {
  filters: mockFilters,
  filterValue: mockFilterValue,
  onFilterChange: jest.fn(),
  onTextFilterChange: jest.fn(),
  resetFilters: jest.fn(),
  travelsData: [],
  filteredTravelsData: [],
  isMobile: false,
  closeMenu: jest.fn(),
  mode: 'radius' as const,
  setMode: jest.fn(),
  transportMode: 'car' as const,
  setTransportMode: jest.fn(),
  startAddress: '',
  endAddress: '',
  routeDistance: null,
  routePoints: [],
  onBuildRoute: jest.fn(),
  routeHintDismissed: false,
  onRouteHintDismiss: jest.fn(),
  onAddressSelect: jest.fn(),
  onAddressClear: jest.fn(),
  routingLoading: false,
  routingError: null,
  mapUiApi: null,
  userLocation: null,
  onPlaceSelect: jest.fn(),
  onOpenList: jest.fn(),
}

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

const renderWithTheme = async (ui: React.ReactNode, contextProps: any = defaultProps) => {
  const queryClient = createQueryClient()
  return await render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <FiltersProvider {...contextProps}>{ui}</FiltersProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('FiltersPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders correctly', async () => {
    const { getByTestId, getByText } = await renderWithTheme(<FiltersPanel />)
    expect(getByTestId('filters-panel')).toBeTruthy()
    expect(getByText('Радиус')).toBeTruthy()
    expect(getByText('Маршрут')).toBeTruthy()
  })

  it('shows reset button when filters are active', async () => {
    const propsWithFilters = {
      ...defaultProps,
      filterValue: {
        ...mockFilterValue,
        categoryTravelAddress: ['Музеи'],
      },
    }
    const { getByTestId } = await renderWithTheme(<FiltersPanel />, propsWithFilters)
    // Radius mode: the footer reset is named for what it resets — on the
    // desktop branch it is the panel's only reset (#2217). The empty state
    // carries a second reset with the same name, hence the footer scope.
    expect(within(getByTestId('filters-panel-footer')).getByLabelText('Сбросить фильтры')).toBeTruthy()
  })

  it('calls resetFilters when reset button is pressed', async () => {
    const propsWithFilters = {
      ...defaultProps,
      filterValue: {
        ...mockFilterValue,
        categoryTravelAddress: ['Музеи'],
      },
    }
    const { getByTestId } = await renderWithTheme(<FiltersPanel />, propsWithFilters)
    const resetButton = within(getByTestId('filters-panel-footer')).getByLabelText('Сбросить фильтры')
    await fireEvent.press(resetButton)
    expect(defaultProps.resetFilters).toHaveBeenCalled()
  })

  it('switches between radius and route modes', async () => {
    const { getByText } = await renderWithTheme(<FiltersPanel />)
    const routeTab = getByText('Маршрут')
    await fireEvent.press(routeTab)
    expect(defaultProps.setMode).toHaveBeenCalledWith('route')
  })

  it('shows the sightseeing section when data is available', async () => {
    const propsWithData = {
      ...defaultProps,
      filterValue: {
        ...mockFilterValue,
        categoryTravelAddress: ['Музеи'],
      },
      travelsData: [
        { categoryName: 'Музеи' },
        { categoryName: 'Музеи' },
        { categoryName: 'Парки' },
      ],
    }
    const { getByText } = await renderWithTheme(<FiltersPanel />, propsWithData)
    expect(getByText('Что посмотреть')).toBeTruthy()
  })

  it('keeps the sightseeing filter visible even when current results are empty', async () => {
    const { getByText } = await renderWithTheme(<FiltersPanel />, {
      ...defaultProps,
      travelsData: [],
      filteredTravelsData: [],
    })

    expect(getByText('Что посмотреть')).toBeTruthy()
  })

  it('shows available sightseeing options in the multi-select instead of an empty modal', async () => {
    const { getByText, queryByText } = await renderWithTheme(
      <FiltersPanel />,
      {
        ...defaultProps,
        travelsData: [
          { categoryName: 'Музеи', name: 'Несвижский замок', address: 'Несвиж' },
          { categoryName: 'Музеи, Парки', name: 'Лошицкий парк', address: 'Минск' },
        ],
      },
    )

    await waitFor(() => {
      expect(getByText('Что посмотреть')).toBeTruthy()
      expect(getByText('Музеи')).toBeTruthy()
      expect(getByText('Парки')).toBeTruthy()
    })

    expect(queryByText('Ничего не найдено')).toBeNull()
  })

  it('falls back to categories from visible map points when filterformap categories are empty', async () => {
    const { getByText, queryByText } = await renderWithTheme(
      <FiltersPanel />,
      {
        ...defaultProps,
        filters: {
          ...mockFilters,
          categoryTravelAddress: [],
        },
        travelsData: [
          { categoryName: 'Замок', name: 'Несвижский замок', address: 'Несвиж' },
          { categoryName: 'Болото, Замок', name: 'Ельня', address: 'Миоры' },
        ],
      },
    )

    await waitFor(() => {
      expect(getByText('Что посмотреть')).toBeTruthy()
      expect(getByText('Замок')).toBeTruthy()
      expect(getByText('Болото')).toBeTruthy()
    })

    expect(queryByText('Ничего не найдено')).toBeNull()
  })

  it('shows the compact mobile header summary and keeps the radius footer actions available', async () => {
    const onOpenList = jest.fn()
    const { getByTestId, getByLabelText, queryByTestId } = await renderWithTheme(<FiltersPanel />, {
      ...defaultProps,
      isMobile: true,
      travelsData: [{ categoryName: 'Музеи' }, { categoryName: 'Парки' }, { categoryName: 'Парки' }],
      filteredTravelsData: [{ categoryName: 'Музеи' }, { categoryName: 'Парки' }, { categoryName: 'Парки' }],
      onOpenList,
    })

    expect(getByTestId('filters-panel-header')).toBeTruthy()
    expect(within(getByTestId('filters-panel-header')).getByText(/3 точки/i)).toBeTruthy()
    expect(queryByTestId('filters-mobile-quick-row')).toBeNull()
    expect(queryByTestId('filters-mobile-context')).toBeNull()
    expect(getByTestId('filters-panel-footer')).toBeTruthy()
    expect(getByTestId('filters-open-list-button')).toBeTruthy()
    expect(getByLabelText('Открыть список мест')).toBeTruthy()
    expect(onOpenList).not.toHaveBeenCalled()
  })

  it('no longer renders radius presets in the panel (radius moved to the on-map control)', async () => {
    const { queryByTestId } = await renderWithTheme(<FiltersPanel />, {
      ...defaultProps,
      filters: {
        ...mockFilters,
        radius: [
          { id: '30', name: '30' },
          { id: '60', name: '60' },
          { id: '100', name: '100' },
        ],
      },
    })

    expect(queryByTestId('radius-presets')).toBeNull()
    expect(queryByTestId('radius-option-100')).toBeNull()
  })

  it('does not render the old radius summary block after choosing categories', async () => {
    const { queryByTestId } = await renderWithTheme(<FiltersPanel />, {
      ...defaultProps,
      travelsData: [
        { categoryName: 'Музеи', name: 'Несвижский замок', address: 'Несвиж' },
        { categoryName: 'Парки', name: 'Лошицкий парк', address: 'Минск' },
      ],
      filterValue: {
        ...mockFilterValue,
        radius: '100',
        categoryTravelAddress: ['Музеи', 'Парки'],
      } as any,
    })

    expect(queryByTestId('radius-selection-summary')).toBeNull()
    expect(queryByTestId('radius-presets')).toBeNull()
  })

  it('makes the empty-state CTA explicit about increasing radius', async () => {
    const { getByText, queryByText } = await renderWithTheme(<FiltersPanel />, {
      ...defaultProps,
      filters: {
        ...mockFilters,
        radius: [
          { id: '60', name: '60' },
          { id: '100', name: '100' },
          { id: '200', name: '200' },
        ],
      },
      travelsData: [],
      filteredTravelsData: [],
      filterValue: {
        ...mockFilterValue,
        radius: '100',
      },
    })

    expect(getByText('Увеличить до 200 км')).toBeTruthy()
    expect(queryByText('Радиус 200 км')).toBeNull()
  })

  it('keeps build button disabled until start and finish are set', async () => {
    const propsRouteMode = {
      ...defaultProps,
      mode: 'route' as const,
    }
    const { getByLabelText } = await renderWithTheme(<FiltersPanel />, propsRouteMode)
    const buildButton = getByLabelText('Построить маршрут')
    expect(buildButton.props.accessibilityState?.disabled).toBe(true)
    expect(buildButton.props.children).toBeTruthy()

    const startOnly: RoutePoint[] = [makePoint('s', 53.9, 27.5, 'start')]
    const { getByLabelText: getByLabelTextStartOnly } = await renderWithTheme(<FiltersPanel />, {
      ...propsRouteMode,
      routePoints: startOnly,
    })
    expect(getByLabelTextStartOnly('Построить маршрут').props.accessibilityState?.disabled).toBe(true)

    const startFinish: RoutePoint[] = [
      makePoint('s', 53.9, 27.5, 'start'),
      makePoint('f', 53.95, 27.6, 'end'),
    ]
    const { getByLabelText: getByLabelTextStartFinish } = await renderWithTheme(<FiltersPanel />, {
      ...propsRouteMode,
      routePoints: startFinish,
    })
    const enabledButton = getByLabelTextStartFinish('Построить маршрут')
    expect(enabledButton.props.accessibilityState?.disabled).not.toBe(true)
    expect(enabledButton.props.children).toBeTruthy()

    const { getByLabelText: getByLabelTextWithDistance } = await renderWithTheme(<FiltersPanel />, {
      ...propsRouteMode,
      routePoints: startFinish,
      routeDistance: 12000,
    })
    expect(getByLabelTextWithDistance('Построить маршрут').props.children).toBeTruthy()
  })

  it('shows inline step hints for start/end', async () => {
    const propsRouteMode = {
      ...defaultProps,
      mode: 'route' as const,
    }
    const { getAllByText } = await renderWithTheme(<FiltersPanel />, propsRouteMode)

    expect(getAllByText(/добавьте старт и финиш/i).length).toBeGreaterThan(0)

    const { queryAllByText: queryAllByTextStartOnly } = await renderWithTheme(<FiltersPanel />, {
      ...propsRouteMode,
      routePoints: [makePoint('s', 53.9, 27.5, 'start')],
    })
    expect(queryAllByTextStartOnly(/добавьте старт и финиш/i).length).toBeGreaterThan(0)

    const { queryAllByText: queryAllByTextStartFinish } = await renderWithTheme(<FiltersPanel />, {
      ...propsRouteMode,
      routePoints: [
        makePoint('s', 53.9, 27.5, 'start'),
        makePoint('f', 53.95, 27.6, 'end'),
      ],
    })
    expect(queryAllByTextStartFinish(/добавьте старт и финиш/i)).toHaveLength(0)
  })

  it('keeps transport selection enabled before and after choosing points', async () => {
    const propsRouteMode = {
      ...defaultProps,
      mode: 'route' as const,
    }
    const { getByTestId } = await renderWithTheme(<FiltersPanel />, propsRouteMode)
    const carTabPressable: any = getByTestId('segmented-car')
    expect(carTabPressable?.props.accessibilityState?.disabled).toBe(false)

    const { getByTestId: getByTestIdEnabled } = await renderWithTheme(<FiltersPanel />, {
      ...propsRouteMode,
      routePoints: [
        makePoint('s', 53.9, 27.5, 'start'),
        makePoint('f', 53.95, 27.6, 'end'),
      ],
    })
    const carTabEnabledPressable: any = getByTestIdEnabled('segmented-car')
    expect(carTabEnabledPressable?.props.accessibilityState?.disabled).toBe(false)
  })

})

// Слои/настройки карты вынесены из левой панели в плавающую иконку «Слои» на
// карте (десктоп) и в верхний тулбар (мобиле). Единый хост контролов слоёв —
// MapMobileLayersPopover, поэтому wiring оверлеев/mapUiApi проверяем на нём.
describe('Map layers controls (MapMobileLayersPopover)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const makeMapUiApi = () => ({
    zoomIn: jest.fn(),
    zoomOut: jest.fn(),
    centerOnUser: jest.fn(),
    fitToResults: jest.fn(),
    exportGpx: jest.fn(),
    exportKml: jest.fn(),
    setBaseLayer: jest.fn(),
    setOverlayEnabled: jest.fn(),
    capabilities: { canCenterOnUser: true, canFitToResults: true, canExportRoute: false },
  })

  const renderLayersPopover = async (mapUiApi: any) =>
    await render(
      <ThemeProvider>
        <MapMobileLayersPopover
          colors={getThemedColors(false)}
          top={68}
          mapUiApi={mapUiApi}
          onRequestClose={jest.fn()}
        />
      </ThemeProvider>,
    )

  it('keeps only fit-to-results action in map settings to avoid duplicated map controls', async () => {
    const mapUiApi = makeMapUiApi()
    const { getByLabelText, queryByLabelText } = await renderLayersPopover(mapUiApi)

    await waitFor(() => {
      expect(getByLabelText('Показать все результаты на карте')).toBeTruthy()
    })

    expect(queryByLabelText('Увеличить масштаб')).toBeNull()
    expect(queryByLabelText('Моё местоположение')).toBeNull()

    await fireEvent.press(getByLabelText('Показать все результаты на карте'))
    expect(mapUiApi.fitToResults).toHaveBeenCalledTimes(1)
  })

  it('renders Waymarked Trails overlays and toggles them via mapUiApi', async () => {
    const mapUiApi = makeMapUiApi()
    const { getByTestId } = await renderLayersPopover(mapUiApi)

    await waitFor(() => {
      expect(getByTestId('map-overlay-waymarked-hiking')).toBeTruthy()
    })

    await fireEvent.press(getByTestId('map-overlay-waymarked-hiking'))
    expect(mapUiApi.setOverlayEnabled).toHaveBeenCalledWith('waymarked-hiking', true)

    await fireEvent.press(getByTestId('map-overlay-waymarked-cycling'))
    expect(mapUiApi.setOverlayEnabled).toHaveBeenCalledWith('waymarked-cycling', true)
  })
})
