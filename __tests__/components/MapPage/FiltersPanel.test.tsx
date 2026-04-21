import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import FiltersPanel from '@/components/MapPage/FiltersPanel'
import { ThemeProvider } from '@/hooks/useTheme'
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
  hideTopControls: false,
  hideFooterCta: false,
  hideFooterReset: false,
}

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

const renderWithTheme = (ui: React.ReactNode, contextProps: any = defaultProps) => {
  const queryClient = createQueryClient()
  return render(
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

  it('renders correctly', () => {
    const { getByTestId, getByText } = renderWithTheme(<FiltersPanel />)
    expect(getByTestId('filters-panel')).toBeTruthy()
    expect(getByText('Радиус')).toBeTruthy()
    expect(getByText('Маршрут')).toBeTruthy()
  })

  it('shows reset button when filters are active', () => {
    const propsWithFilters = {
      ...defaultProps,
      filterValue: {
        ...mockFilterValue,
        categoryTravelAddress: ['Музеи'],
      },
    }
    const { getByLabelText } = renderWithTheme(<FiltersPanel />, propsWithFilters)
    expect(getByLabelText('Сбросить')).toBeTruthy()
  })

  it('calls resetFilters when reset button is pressed', () => {
    const propsWithFilters = {
      ...defaultProps,
      filterValue: {
        ...mockFilterValue,
        categoryTravelAddress: ['Музеи'],
      },
    }
    const { getByLabelText } = renderWithTheme(<FiltersPanel />, propsWithFilters)
    const resetButton = getByLabelText('Сбросить')
    fireEvent.press(resetButton)
    expect(defaultProps.resetFilters).toHaveBeenCalled()
  })

  it('switches between radius and route modes', () => {
    const { getByText } = renderWithTheme(<FiltersPanel />)
    const routeTab = getByText('Маршрут')
    fireEvent.press(routeTab)
    expect(defaultProps.setMode).toHaveBeenCalledWith('route')
  })

  it('shows the sightseeing section when data is available', () => {
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
    const { getByText } = renderWithTheme(<FiltersPanel />, propsWithData)
    expect(getByText('Что посмотреть')).toBeTruthy()
  })

  it('keeps the sightseeing filter visible even when current results are empty', () => {
    const { getByText } = renderWithTheme(<FiltersPanel />, {
      ...defaultProps,
      travelsData: [],
      filteredTravelsData: [],
    })

    expect(getByText('Что посмотреть')).toBeTruthy()
  })

  it('shows available sightseeing options in the multi-select instead of an empty modal', async () => {
    const { getByText, getByLabelText, queryByText, getByTestId } = renderWithTheme(
      <FiltersPanel />,
      {
        ...defaultProps,
        travelsData: [
          { categoryName: 'Музеи', name: 'Несвижский замок', address: 'Несвиж' },
          { categoryName: 'Музеи, Парки', name: 'Лошицкий парк', address: 'Минск' },
        ],
      },
    )

    fireEvent.press(getByText('Что посмотреть'))
    fireEvent.press(getByLabelText('Открыть выбор'))

    await waitFor(() => {
      expect(getByText('Выбрано: 0')).toBeTruthy()
      expect(getByText('Музеи (2)')).toBeTruthy()
      expect(getByText('Парки (1)')).toBeTruthy()
      expect(getByTestId('simple-multiselect.item.Музеи')).toBeTruthy()
    })

    expect(queryByText('Ничего не найдено')).toBeNull()
  })

  it('falls back to categories from visible map points when filterformap categories are empty', async () => {
    const { getByText, getByLabelText, queryByText, getByTestId } = renderWithTheme(
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

    fireEvent.press(getByText('Что посмотреть'))
    fireEvent.press(getByLabelText('Открыть выбор'))

    await waitFor(() => {
      expect(getByText('Замок (2)')).toBeTruthy()
      expect(getByText('Болото (1)')).toBeTruthy()
      expect(getByTestId('simple-multiselect.item.Замок')).toBeTruthy()
    })

    expect(queryByText('Ничего не найдено')).toBeNull()
  })

  it('shows the compact mobile header summary and keeps the radius footer actions available', () => {
    const onOpenList = jest.fn()
    const { getByTestId, getByText } = renderWithTheme(<FiltersPanel />, {
      ...defaultProps,
      isMobile: true,
      travelsData: [{ categoryName: 'Музеи' }, { categoryName: 'Парки' }, { categoryName: 'Парки' }],
      filteredTravelsData: [{ categoryName: 'Музеи' }, { categoryName: 'Парки' }, { categoryName: 'Парки' }],
      onOpenList,
    })

    expect(getByTestId('filters-panel-header')).toBeTruthy()
    expect(getByText('3 места · 60 км')).toBeTruthy()
    expect(getByTestId('filters-panel-footer')).toBeTruthy()
    expect(getByText('Показать 3')).toBeTruthy()
    expect(onOpenList).not.toHaveBeenCalled()
  })

  it('shows an inline radius selection summary after choosing categories', () => {
    const { getByTestId, getByText, getAllByText } = renderWithTheme(<FiltersPanel />, {
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

    expect(getByTestId('radius-selection-summary')).toBeTruthy()
    expect(getByText('Музеи, Парки')).toBeTruthy()
    expect(getAllByText('100 км').length).toBeGreaterThan(0)
  })

  it('makes the empty-state CTA explicit about increasing radius', () => {
    const { getByText, queryByText } = renderWithTheme(<FiltersPanel />, {
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

  it('keeps build button disabled until start and finish are set', () => {
    const propsRouteMode = {
      ...defaultProps,
      mode: 'route' as const,
    }
    const { getByLabelText } = renderWithTheme(<FiltersPanel />, propsRouteMode)
    const buildButton = getByLabelText('Построить маршрут')
    expect(buildButton.props.accessibilityState?.disabled).toBe(true)
    expect(buildButton.props.children).toBeTruthy()

    const startOnly: RoutePoint[] = [makePoint('s', 53.9, 27.5, 'start')]
    const { getByLabelText: getByLabelTextStartOnly } = renderWithTheme(<FiltersPanel />, {
      ...propsRouteMode,
      routePoints: startOnly,
    })
    expect(getByLabelTextStartOnly('Построить маршрут').props.accessibilityState?.disabled).toBe(true)

    const startFinish: RoutePoint[] = [
      makePoint('s', 53.9, 27.5, 'start'),
      makePoint('f', 53.95, 27.6, 'end'),
    ]
    const { getByLabelText: getByLabelTextStartFinish } = renderWithTheme(<FiltersPanel />, {
      ...propsRouteMode,
      routePoints: startFinish,
    })
    const enabledButton = getByLabelTextStartFinish('Построить маршрут')
    expect(enabledButton.props.accessibilityState?.disabled).not.toBe(true)
    expect(enabledButton.props.children).toBeTruthy()

    const { getByLabelText: getByLabelTextWithDistance } = renderWithTheme(<FiltersPanel />, {
      ...propsRouteMode,
      routePoints: startFinish,
      routeDistance: 12000,
    })
    expect(getByLabelTextWithDistance('Построить маршрут').props.children).toBeTruthy()
  })

  it('shows inline step hints for start/end', () => {
    const propsRouteMode = {
      ...defaultProps,
      mode: 'route' as const,
    }
    const { getAllByText } = renderWithTheme(<FiltersPanel />, propsRouteMode)

    expect(getAllByText(/добавьте старт и финиш/i).length).toBeGreaterThan(0)

    const { queryAllByText: queryAllByTextStartOnly } = renderWithTheme(<FiltersPanel />, {
      ...propsRouteMode,
      routePoints: [makePoint('s', 53.9, 27.5, 'start')],
    })
    expect(queryAllByTextStartOnly(/добавьте старт и финиш/i).length).toBeGreaterThan(0)

    const { queryAllByText: queryAllByTextStartFinish } = renderWithTheme(<FiltersPanel />, {
      ...propsRouteMode,
      routePoints: [
        makePoint('s', 53.9, 27.5, 'start'),
        makePoint('f', 53.95, 27.6, 'end'),
      ],
    })
    expect(queryAllByTextStartFinish(/добавьте старт и финиш/i)).toHaveLength(0)
  })

  it('keeps transport selection enabled before and after choosing points', () => {
    const propsRouteMode = {
      ...defaultProps,
      mode: 'route' as const,
    }
    const { getByTestId } = renderWithTheme(<FiltersPanel />, propsRouteMode)
    const carTabPressable: any = getByTestId('segmented-car')
    expect(carTabPressable?.props.accessibilityState?.disabled).toBe(false)

    const { getByTestId: getByTestIdEnabled } = renderWithTheme(<FiltersPanel />, {
      ...propsRouteMode,
      routePoints: [
        makePoint('s', 53.9, 27.5, 'start'),
        makePoint('f', 53.95, 27.6, 'end'),
      ],
    })
    const carTabEnabledPressable: any = getByTestIdEnabled('segmented-car')
    expect(carTabEnabledPressable?.props.accessibilityState?.disabled).toBe(false)
  })

  it('calls mapUiApi.zoomIn when Zoom + pressed', async () => {
    const mapUiApi = {
      zoomIn: jest.fn(),
      zoomOut: jest.fn(),
      centerOnUser: jest.fn(),
      fitToResults: jest.fn(),
      exportGpx: jest.fn(),
      exportKml: jest.fn(),
      setBaseLayer: jest.fn(),
      setOverlayEnabled: jest.fn(),
      capabilities: { canCenterOnUser: true, canFitToResults: true, canExportRoute: false },
    }

    const { getByTestId, getByLabelText } = renderWithTheme(<FiltersPanel />, {
      ...defaultProps,
      mapUiApi: mapUiApi as any,
    })

    const collapsible = getByTestId('collapsible-Инструменты карты')
    if (collapsible.props.accessibilityState?.expanded === false) {
      fireEvent.press(collapsible)
    }

    await waitFor(() => {
      expect(getByLabelText('Увеличить масштаб')).toBeTruthy()
    })

    fireEvent.press(getByLabelText('Увеличить масштаб'))
    expect(mapUiApi.zoomIn).toHaveBeenCalled()
  })

  it('disables center on user button when user location is unavailable', async () => {
    const mapUiApi = {
      zoomIn: jest.fn(),
      zoomOut: jest.fn(),
      centerOnUser: jest.fn(),
      fitToResults: jest.fn(),
      exportGpx: jest.fn(),
      exportKml: jest.fn(),
      setBaseLayer: jest.fn(),
      setOverlayEnabled: jest.fn(),
      capabilities: { canCenterOnUser: false, canFitToResults: true, canExportRoute: false },
    }

    const { getByTestId, getByLabelText } = renderWithTheme(<FiltersPanel />, {
      ...defaultProps,
      mapUiApi: mapUiApi as any,
    })

    const collapsible = getByTestId('collapsible-Инструменты карты')
    if (collapsible.props.accessibilityState?.expanded === false) {
      fireEvent.press(collapsible)
    }

    await waitFor(() => {
      expect(getByLabelText('Моё местоположение')).toBeTruthy()
    })

    const btn = getByLabelText('Моё местоположение')
    expect(btn.props.accessibilityState?.disabled).toBe(true)
  })

  it('calls centerOnUser when user location is available', async () => {
    const mapUiApi = {
      zoomIn: jest.fn(),
      zoomOut: jest.fn(),
      centerOnUser: jest.fn(),
      fitToResults: jest.fn(),
      exportGpx: jest.fn(),
      exportKml: jest.fn(),
      setBaseLayer: jest.fn(),
      setOverlayEnabled: jest.fn(),
      capabilities: { canCenterOnUser: true, canFitToResults: true, canExportRoute: false },
    }

    const { getByTestId, getByLabelText } = renderWithTheme(<FiltersPanel />, {
      ...defaultProps,
      mapUiApi: mapUiApi as any,
    })

    const collapsible = getByTestId('collapsible-Инструменты карты')
    if (collapsible.props.accessibilityState?.expanded === false) {
      fireEvent.press(collapsible)
    }

    await waitFor(() => {
      expect(getByLabelText('Моё местоположение')).toBeTruthy()
    })

    const btn = getByLabelText('Моё местоположение')
    expect(btn.props.accessibilityState?.disabled).not.toBe(true)
    fireEvent.press(btn)
    expect(mapUiApi.centerOnUser).toHaveBeenCalled()
  })

  it('renders Waymarked Trails overlays and toggles them via mapUiApi', async () => {
    const mapUiApi = {
      zoomIn: jest.fn(),
      zoomOut: jest.fn(),
      centerOnUser: jest.fn(),
      fitToResults: jest.fn(),
      exportGpx: jest.fn(),
      exportKml: jest.fn(),
      setBaseLayer: jest.fn(),
      setOverlayEnabled: jest.fn(),
      capabilities: { canCenterOnUser: true, canFitToResults: true, canExportRoute: false },
    }

    const { getByTestId } = renderWithTheme(<FiltersPanel />, {
      ...defaultProps,
      mapUiApi: mapUiApi as any,
    })

    const collapsible = getByTestId('collapsible-Инструменты карты')
    if (collapsible.props.accessibilityState?.expanded === false) {
      fireEvent.press(collapsible)
    }

    await waitFor(() => {
      expect(getByTestId('map-overlay-waymarked-hiking')).toBeTruthy()
    })

    fireEvent.press(getByTestId('map-overlay-waymarked-hiking'))
    expect(mapUiApi.setOverlayEnabled).toHaveBeenCalledWith('waymarked-hiking', true)

    fireEvent.press(getByTestId('map-overlay-waymarked-cycling'))
    expect(mapUiApi.setOverlayEnabled).toHaveBeenCalledWith('waymarked-cycling', true)
  })
})
