/**
 * #2218 — fit «to all places» after a reset uses the results of the reset input.
 */
import { renderHook, act } from '@testing-library/react-native'

// ─── моки зависимостей хука ───────────────────────────────────────────────────
jest.mock('expo-router', () => ({
  usePathname: () => '/map',
  useLocalSearchParams: () => ({}),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock('@/hooks/map/useMapCoordinates', () => ({
  useMapCoordinates: () => ({
    coordinates: { latitude: 53.9, longitude: 27.5667 },
    updateCoordinates: jest.fn(),
    error: null,
  }),
}))

jest.mock('@/hooks/map/useMapFilters', () => ({
  useMapFilters: () => ({
    filters: { categories: [], categoryTravelAddress: [], radius: [], address: [] },
    filterValues: { categories: [], categoryTravelAddress: [], radius: '60', address: '' },
    handleFilterChangeForPanel: jest.fn(),
    resetFilters: jest.fn(),
  }),
}))

jest.mock('@/hooks/map/useMapPanelState', () => ({
  useMapResponsive: () => ({ isMobile: false, width: 1280 }),
  useMapPanelState: () => ({
    isFocused: true,
    mapReady: true,
    rightPanelTab: 'list',
    isDesktopCollapsed: false,
    desktopPanelWidth: 384,
    selectFiltersTab: jest.fn(),
    selectTravelsTab: jest.fn(),
    openRightPanel: jest.fn(),
    closeRightPanel: jest.fn(),
    toggleDesktopCollapse: jest.fn(),
    onResizePanelWidth: jest.fn(),
    panelStyle: {},
    filtersTabRef: { current: null },
    panelRef: { current: null },
  }),
}))

jest.mock('@/hooks/useSafeAreaInsetsSafe', () => ({
  useSafeAreaInsetsSafe: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock('@/utils/seo', () => ({
  buildCanonicalUrl: () => 'http://localhost/map',
}))

const mockData: Record<string, any> = {}
jest.mock('@/hooks/map/useMapDataController', () => ({
  useMapDataController: () => ({
    allTravelsData: mockData.travelsData,
    travelsData: mockData.travelsData,
    loading: false,
    isFetching: mockData.isFetching,
    isPlaceholderData: mockData.isPlaceholderData,
    isDebouncingFilters: mockData.isDebouncingFilters,
    mapError: null,
    mapErrorDetails: null,
    refetchMapData: jest.fn(),
    invalidateTravelsQuery: jest.fn(),
  }),
}))

jest.mock('@/hooks/map/useRouteController', () => ({
  useRouteController: () => ({
    mode: 'radius',
    setMode: jest.fn(),
    transportMode: 'car',
    setTransportMode: jest.fn(),
    routeStorePoints: [],
    startAddress: null,
    endAddress: null,
    routeDistance: null,
    fullRouteCoords: [],
    routingLoading: false,
    routingError: null,
    handleMapClick: jest.fn(),
    buildRouteTo: jest.fn(),
    handleClearRoute: jest.fn(),
    handleAddressSelect: jest.fn(),
    handleAddressClear: jest.fn(),
    onRemoveRoutePoint: jest.fn(),
    swapStartEnd: jest.fn(),
  }),
}))

jest.mock('@/hooks/useRouteStoreAdapter', () => ({
  useRouteStoreAdapter: () => ({
    mode: 'radius',
    setMode: jest.fn(),
    transportMode: 'car',
    setTransportMode: jest.fn(),
    routePoints: [],
    startAddress: null,
    endAddress: null,
    routeDistance: null,
    fullRouteCoords: [],
    setRoutePoints: jest.fn(),
    setRouteDistance: jest.fn(),
    setFullRouteCoords: jest.fn(),
    handleClearRoute: jest.fn(),
    handleAddressSelect: jest.fn(),
    points: [],
    isBuilding: false,
    error: null,
    clearRoute: jest.fn(),
    removePoint: jest.fn(),
    swapStartEnd: jest.fn(),
  }),
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    primary: '#000',
    text: '#000',
    textMuted: '#666',
    surface: '#fff',
    surfaceMuted: 'rgba(255,255,255,0.75)',
    border: '#ddd',
    borderLight: '#eee',
  }),
}))

jest.mock('@/screens/tabs/map.styles', () => ({
  getStyles: () => ({}),
}))

jest.mock('@/utils/logger', () => ({
  logMessage: jest.fn(),
}))

jest.mock('@/utils/mapFiltersStorage', () => ({
  loadMapFilterValues: () => ({
    lastMode: 'radius',
    transportMode: 'car',
  }),
  saveMapFilterValues: jest.fn(),
}))

jest.mock('@/hooks/map/mapFiltersPanelLoader', () => ({
  FiltersPanelComponent: null,
  FiltersProviderComponent: null,
  preloadMapFiltersPanel: jest.fn(),
}))

jest.mock('@/stores/routeStore', () => ({
  useRouteStore: Object.assign(jest.fn(() => ({})), {
    getState: () => ({
      clearRouteAndSetMode: jest.fn(),
      forceRebuild: jest.fn(),
    }),
  }),
}))


// ─── подключаем хук после всех моков ─────────────────────────────────────────
import { useMapScreenController } from '@/hooks/useMapScreenController'

const AMBAR = [{ id: 1, coord: '53.6354,27.2197' }]
const ALL = [
  { id: 1, coord: '53.6354,27.2197' },
  { id: 2, coord: '55.2,28.5' },
  { id: 3, coord: '52.6,26.4' },
]

const setData = (patch: Record<string, any>) => Object.assign(mockData, patch)

// The engine fits to the result set it holds when called (web rebuilds the
// API per data, native reads its own ref): the API is handed over again
// whenever the map receives a new result set.
const handMapApi = (result: any, fits: unknown[][]) => {
  const places = mockData.travelsData
  act(() => {
    result.current.mapPanelProps.onMapUiApiReady({ fitToResults: () => fits.push(places) })
  })
}

/**
 * #2218 (device QA, Android): «Сбросить все фильтры» with one place left fitted
 * the map to that place (zoom 14), and `map-mobile-show-all` from an empty result
 * did not move the map — the fit ran one frame after the reset, over the result
 * set from BEFORE it. The fit now waits for the results of the reset input.
 */
describe('useMapScreenController — «Показать всё» подгоняет по местам после сброса (#2218)', () => {
  beforeEach(() => {
    setData({ travelsData: AMBAR, isFetching: false, isPlaceholderData: false, isDebouncingFilters: false })
  })

  it('сброс → debounce → запрос → новые места → один fit по новым местам', () => {
    const fits: unknown[][] = []
    const { result, rerender } = renderHook(() => useMapScreenController())
    handMapApi(result, fits)

    setData({ isDebouncingFilters: true })
    act(() => {
      result.current.showAllPlaces()
    })
    rerender({})
    expect(fits).toEqual([])

    setData({ isDebouncingFilters: false, isFetching: true, isPlaceholderData: true })
    rerender({})
    expect(fits).toEqual([])

    setData({ travelsData: ALL, isFetching: false, isPlaceholderData: false })
    handMapApi(result, fits)
    rerender({})
    expect(fits).toEqual([ALL])

    // Later refetches do not fit again: the request was one-shot.
    setData({ isFetching: true })
    rerender({})
    setData({ isFetching: false })
    rerender({})
    expect(fits).toEqual([ALL])
  })

  it('из пустого результата подгоняет под вернувшиеся места', () => {
    setData({ travelsData: [] })
    const fits: unknown[][] = []
    const { result, rerender } = renderHook(() => useMapScreenController())
    handMapApi(result, fits)

    setData({ isFetching: true, isPlaceholderData: true })
    act(() => {
      result.current.showAllPlaces()
    })
    rerender({})
    expect(fits).toEqual([])

    setData({ travelsData: ALL, isFetching: false, isPlaceholderData: false })
    handMapApi(result, fits)
    rerender({})
    expect(fits).toEqual([ALL])
  })

  it('если сбрасывать нечего, подгоняет сразу по текущим местам', () => {
    setData({ travelsData: ALL })
    const fits: unknown[][] = []
    const { result } = renderHook(() => useMapScreenController())
    handMapApi(result, fits)

    act(() => {
      result.current.showAllPlaces()
    })
    expect(fits).toEqual([ALL])
  })
})
