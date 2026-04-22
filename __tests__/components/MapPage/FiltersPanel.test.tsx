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
    { id: 1, name: 'ÐœÑƒÐ·ÐµÐ¸' },
    { id: 2, name: 'ÐŸÐ°Ñ€ÐºÐ¸' },
  ],
  categoryTravelAddress: [
    { id: 1, name: 'ÐœÑƒÐ·ÐµÐ¸' },
    { id: 2, name: 'ÐŸÐ°Ñ€ÐºÐ¸' },
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
    expect(getByText('Ð Ð°Ð´Ð¸ÑƒÑ')).toBeTruthy()
    expect(getByText('ÐœÐ°Ñ€ÑˆÑ€ÑƒÑ‚')).toBeTruthy()
  })

  it('shows reset button when filters are active', () => {
    const propsWithFilters = {
      ...defaultProps,
      filterValue: {
        ...mockFilterValue,
        categoryTravelAddress: ['ÐœÑƒÐ·ÐµÐ¸'],
      },
    }
    const { getByLabelText } = renderWithTheme(<FiltersPanel />, propsWithFilters)
    expect(getByLabelText('Ð¡Ð±Ñ€Ð¾ÑÐ¸Ñ‚ÑŒ')).toBeTruthy()
  })

  it('calls resetFilters when reset button is pressed', () => {
    const propsWithFilters = {
      ...defaultProps,
      filterValue: {
        ...mockFilterValue,
        categoryTravelAddress: ['ÐœÑƒÐ·ÐµÐ¸'],
      },
    }
    const { getByLabelText } = renderWithTheme(<FiltersPanel />, propsWithFilters)
    const resetButton = getByLabelText('Ð¡Ð±Ñ€Ð¾ÑÐ¸Ñ‚ÑŒ')
    fireEvent.press(resetButton)
    expect(defaultProps.resetFilters).toHaveBeenCalled()
  })

  it('switches between radius and route modes', () => {
    const { getByText } = renderWithTheme(<FiltersPanel />)
    const routeTab = getByText('ÐœÐ°Ñ€ÑˆÑ€ÑƒÑ‚')
    fireEvent.press(routeTab)
    expect(defaultProps.setMode).toHaveBeenCalledWith('route')
  })

  it('shows the sightseeing section when data is available', () => {
    const propsWithData = {
      ...defaultProps,
      filterValue: {
        ...mockFilterValue,
        categoryTravelAddress: ['ÐœÑƒÐ·ÐµÐ¸'],
      },
      travelsData: [
        { categoryName: 'ÐœÑƒÐ·ÐµÐ¸' },
        { categoryName: 'ÐœÑƒÐ·ÐµÐ¸' },
        { categoryName: 'ÐŸÐ°Ñ€ÐºÐ¸' },
      ],
    }
    const { getByText } = renderWithTheme(<FiltersPanel />, propsWithData)
    expect(getByText('Ð§Ñ‚Ð¾ Ð¿Ð¾ÑÐ¼Ð¾Ñ‚Ñ€ÐµÑ‚ÑŒ')).toBeTruthy()
  })

  it('keeps the sightseeing filter visible even when current results are empty', () => {
    const { getByText } = renderWithTheme(<FiltersPanel />, {
      ...defaultProps,
      travelsData: [],
      filteredTravelsData: [],
    })

    expect(getByText('Ð§Ñ‚Ð¾ Ð¿Ð¾ÑÐ¼Ð¾Ñ‚Ñ€ÐµÑ‚ÑŒ')).toBeTruthy()
  })

  it('shows available sightseeing options in the multi-select instead of an empty modal', async () => {
    const { getByText, getByLabelText, queryByText, getByTestId } = renderWithTheme(
      <FiltersPanel />,
      {
        ...defaultProps,
        travelsData: [
          { categoryName: 'ÐœÑƒÐ·ÐµÐ¸', name: 'ÐÐµÑÐ²Ð¸Ð¶ÑÐºÐ¸Ð¹ Ð·Ð°Ð¼Ð¾Ðº', address: 'ÐÐµÑÐ²Ð¸Ð¶' },
          { categoryName: 'ÐœÑƒÐ·ÐµÐ¸, ÐŸÐ°Ñ€ÐºÐ¸', name: 'Ð›Ð¾ÑˆÐ¸Ñ†ÐºÐ¸Ð¹ Ð¿Ð°Ñ€Ðº', address: 'ÐœÐ¸Ð½ÑÐº' },
        ],
      },
    )

    fireEvent.press(getByText('Ð§Ñ‚Ð¾ Ð¿Ð¾ÑÐ¼Ð¾Ñ‚Ñ€ÐµÑ‚ÑŒ'))
    fireEvent.press(getByLabelText('ÐžÑ‚ÐºÑ€Ñ‹Ñ‚ÑŒ Ð²Ñ‹Ð±Ð¾Ñ€'))

    await waitFor(() => {
      expect(getByText('Ð’Ñ‹Ð±Ñ€Ð°Ð½Ð¾: 0')).toBeTruthy()
      expect(getByText('ÐœÑƒÐ·ÐµÐ¸ (2)')).toBeTruthy()
      expect(getByText('ÐŸÐ°Ñ€ÐºÐ¸ (1)')).toBeTruthy()
      expect(getByTestId('simple-multiselect.item.ÐœÑƒÐ·ÐµÐ¸')).toBeTruthy()
    })

    expect(queryByText('ÐÐ¸Ñ‡ÐµÐ³Ð¾ Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½Ð¾')).toBeNull()
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
          { categoryName: 'Ð—Ð°Ð¼Ð¾Ðº', name: 'ÐÐµÑÐ²Ð¸Ð¶ÑÐºÐ¸Ð¹ Ð·Ð°Ð¼Ð¾Ðº', address: 'ÐÐµÑÐ²Ð¸Ð¶' },
          { categoryName: 'Ð‘Ð¾Ð»Ð¾Ñ‚Ð¾, Ð—Ð°Ð¼Ð¾Ðº', name: 'Ð•Ð»ÑŒÐ½Ñ', address: 'ÐœÐ¸Ð¾Ñ€Ñ‹' },
        ],
      },
    )

    fireEvent.press(getByText('Ð§Ñ‚Ð¾ Ð¿Ð¾ÑÐ¼Ð¾Ñ‚Ñ€ÐµÑ‚ÑŒ'))
    fireEvent.press(getByLabelText('ÐžÑ‚ÐºÑ€Ñ‹Ñ‚ÑŒ Ð²Ñ‹Ð±Ð¾Ñ€'))

    await waitFor(() => {
      expect(getByText('Ð—Ð°Ð¼Ð¾Ðº (2)')).toBeTruthy()
      expect(getByText('Ð‘Ð¾Ð»Ð¾Ñ‚Ð¾ (1)')).toBeTruthy()
      expect(getByTestId('simple-multiselect.item.Ð—Ð°Ð¼Ð¾Ðº')).toBeTruthy()
    })

    expect(queryByText('ÐÐ¸Ñ‡ÐµÐ³Ð¾ Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½Ð¾')).toBeNull()
  })

  it('shows the compact mobile header summary and keeps the radius footer actions available', () => {
    const onOpenList = jest.fn()
    const { getByTestId, getAllByText, getByText, queryByTestId } = renderWithTheme(<FiltersPanel />, {
      ...defaultProps,
      isMobile: true,
      travelsData: [{ categoryName: 'ÐœÑƒÐ·ÐµÐ¸' }, { categoryName: 'ÐŸÐ°Ñ€ÐºÐ¸' }, { categoryName: 'ÐŸÐ°Ñ€ÐºÐ¸' }],
      filteredTravelsData: [{ categoryName: 'ÐœÑƒÐ·ÐµÐ¸' }, { categoryName: 'ÐŸÐ°Ñ€ÐºÐ¸' }, { categoryName: 'ÐŸÐ°Ñ€ÐºÐ¸' }],
      onOpenList,
    })

    expect(getByTestId('filters-panel-header')).toBeTruthy()
    expect(getByText('3 Ð¼ÐµÑÑ‚Ð° Â· 60 ÐºÐ¼')).toBeTruthy()
    expect(queryByTestId('filters-mobile-quick-row')).toBeNull()
    expect(queryByTestId('filters-mobile-context')).toBeNull()
    expect(getByTestId('filters-panel-footer')).toBeTruthy()
    expect(getAllByText('ÐŸÐ¾ÐºÐ°Ð·Ð°Ñ‚ÑŒ 3')).toHaveLength(1)
    expect(getByTestId('filters-open-list-button')).toBeTruthy()
    expect(onOpenList).not.toHaveBeenCalled()
  })

  it('renders radius presets in the panel and updates the selected radius', () => {
    const onFilterChange = jest.fn()
    const { getByTestId } = renderWithTheme(<FiltersPanel />, {
      ...defaultProps,
      onFilterChange,
      filters: {
        ...mockFilters,
        radius: [
          { id: '30', name: '30' },
          { id: '60', name: '60' },
          { id: '100', name: '100' },
        ],
      },
    })

    expect(getByTestId('radius-presets')).toBeTruthy()
    fireEvent.press(getByTestId('radius-option-100'))

    expect(onFilterChange).toHaveBeenCalledWith('radius', '100')
  })

  it('does not render the old radius summary block after choosing categories', () => {
    const { queryByTestId, getAllByText } = renderWithTheme(<FiltersPanel />, {
      ...defaultProps,
      travelsData: [
        { categoryName: 'ÐœÑƒÐ·ÐµÐ¸', name: 'ÐÐµÑÐ²Ð¸Ð¶ÑÐºÐ¸Ð¹ Ð·Ð°Ð¼Ð¾Ðº', address: 'ÐÐµÑÐ²Ð¸Ð¶' },
        { categoryName: 'ÐŸÐ°Ñ€ÐºÐ¸', name: 'Ð›Ð¾ÑˆÐ¸Ñ†ÐºÐ¸Ð¹ Ð¿Ð°Ñ€Ðº', address: 'ÐœÐ¸Ð½ÑÐº' },
      ],
      filterValue: {
        ...mockFilterValue,
        radius: '100',
        categoryTravelAddress: ['ÐœÑƒÐ·ÐµÐ¸', 'ÐŸÐ°Ñ€ÐºÐ¸'],
      } as any,
    })

    expect(queryByTestId('radius-selection-summary')).toBeNull()
    expect(getAllByText('100 ÐºÐ¼').length).toBeGreaterThan(0)
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

    expect(getByText('Ð£Ð²ÐµÐ»Ð¸Ñ‡Ð¸Ñ‚ÑŒ Ð´Ð¾ 200 ÐºÐ¼')).toBeTruthy()
    expect(queryByText('Ð Ð°Ð´Ð¸ÑƒÑ 200 ÐºÐ¼')).toBeNull()
  })

  it('keeps build button disabled until start and finish are set', () => {
    const propsRouteMode = {
      ...defaultProps,
      mode: 'route' as const,
    }
    const { getByLabelText } = renderWithTheme(<FiltersPanel />, propsRouteMode)
    const buildButton = getByLabelText('ÐŸÐ¾ÑÑ‚Ñ€Ð¾Ð¸Ñ‚ÑŒ Ð¼Ð°Ñ€ÑˆÑ€ÑƒÑ‚')
    expect(buildButton.props.accessibilityState?.disabled).toBe(true)
    expect(buildButton.props.children).toBeTruthy()

    const startOnly: RoutePoint[] = [makePoint('s', 53.9, 27.5, 'start')]
    const { getByLabelText: getByLabelTextStartOnly } = renderWithTheme(<FiltersPanel />, {
      ...propsRouteMode,
      routePoints: startOnly,
    })
    expect(getByLabelTextStartOnly('ÐŸÐ¾ÑÑ‚Ñ€Ð¾Ð¸Ñ‚ÑŒ Ð¼Ð°Ñ€ÑˆÑ€ÑƒÑ‚').props.accessibilityState?.disabled).toBe(true)

    const startFinish: RoutePoint[] = [
      makePoint('s', 53.9, 27.5, 'start'),
      makePoint('f', 53.95, 27.6, 'end'),
    ]
    const { getByLabelText: getByLabelTextStartFinish } = renderWithTheme(<FiltersPanel />, {
      ...propsRouteMode,
      routePoints: startFinish,
    })
    const enabledButton = getByLabelTextStartFinish('ÐŸÐ¾ÑÑ‚Ñ€Ð¾Ð¸Ñ‚ÑŒ Ð¼Ð°Ñ€ÑˆÑ€ÑƒÑ‚')
    expect(enabledButton.props.accessibilityState?.disabled).not.toBe(true)
    expect(enabledButton.props.children).toBeTruthy()

    const { getByLabelText: getByLabelTextWithDistance } = renderWithTheme(<FiltersPanel />, {
      ...propsRouteMode,
      routePoints: startFinish,
      routeDistance: 12000,
    })
    expect(getByLabelTextWithDistance('ÐŸÐ¾ÑÑ‚Ñ€Ð¾Ð¸Ñ‚ÑŒ Ð¼Ð°Ñ€ÑˆÑ€ÑƒÑ‚').props.children).toBeTruthy()
  })

  it('shows inline step hints for start/end', () => {
    const propsRouteMode = {
      ...defaultProps,
      mode: 'route' as const,
    }
    const { getAllByText } = renderWithTheme(<FiltersPanel />, propsRouteMode)

    expect(getAllByText(/Ð´Ð¾Ð±Ð°Ð²ÑŒÑ‚Ðµ ÑÑ‚Ð°Ñ€Ñ‚ Ð¸ Ñ„Ð¸Ð½Ð¸Ñˆ/i).length).toBeGreaterThan(0)

    const { queryAllByText: queryAllByTextStartOnly } = renderWithTheme(<FiltersPanel />, {
      ...propsRouteMode,
      routePoints: [makePoint('s', 53.9, 27.5, 'start')],
    })
    expect(queryAllByTextStartOnly(/Ð´Ð¾Ð±Ð°Ð²ÑŒÑ‚Ðµ ÑÑ‚Ð°Ñ€Ñ‚ Ð¸ Ñ„Ð¸Ð½Ð¸Ñˆ/i).length).toBeGreaterThan(0)

    const { queryAllByText: queryAllByTextStartFinish } = renderWithTheme(<FiltersPanel />, {
      ...propsRouteMode,
      routePoints: [
        makePoint('s', 53.9, 27.5, 'start'),
        makePoint('f', 53.95, 27.6, 'end'),
      ],
    })
    expect(queryAllByTextStartFinish(/Ð´Ð¾Ð±Ð°Ð²ÑŒÑ‚Ðµ ÑÑ‚Ð°Ñ€Ñ‚ Ð¸ Ñ„Ð¸Ð½Ð¸Ñˆ/i)).toHaveLength(0)
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

  it('keeps only fit-to-results action in map settings to avoid duplicated map controls', async () => {
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

    const { getByTestId, getByLabelText, queryByLabelText } = renderWithTheme(<FiltersPanel />, {
      ...defaultProps,
      mapUiApi: mapUiApi as any,
    })

    const collapsible = getByTestId('collapsible-Управление картой')
    if (collapsible.props.accessibilityState?.expanded === false) {
      fireEvent.press(collapsible)
    }

    await waitFor(() => {
      expect(getByLabelText('Показать все результаты на карте')).toBeTruthy()
    })

    expect(queryByLabelText('Увеличить масштаб')).toBeNull()
    expect(queryByLabelText('Моё местоположение')).toBeNull()

    fireEvent.press(getByLabelText('Показать все результаты на карте'))
    expect(mapUiApi.fitToResults).toHaveBeenCalledTimes(1)
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

    const collapsible = getByTestId('collapsible-Ð£Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð¸Ðµ ÐºÐ°Ñ€Ñ‚Ð¾Ð¹')
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
