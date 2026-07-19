/**
 * #991 — smoke-набор platform-agnostic поведенческого ядра карты.
 * Контрактные инварианты, которые обязаны пережить любой рефактор:
 *  - mapPanelProps несёт единый набор ключей для обоих рендер-адаптеров;
 *  - #207-гейты (onMarkerSelect/suppressLeafletPopupOnSelect) зависят от isMobile;
 *  - precedence координат запроса: searchArea → URL → user → resolved (F-49);
 *  - маркер-тап кормит маршрут ТОЛЬКО пока в нём <2 точек (#FIX-2);
 *  - resetCoreForFilters сбрасывает search-area якорь и маршрут атомарно.
 */
import { renderHook, act } from '@testing-library/react-native'

const mockSetSearchAreaCenter = jest.fn()
const mockClearRouteAndSetMode = jest.fn()
const mockAddRoutePointFromTravel = jest.fn()

let mockRouteStoreState = { mode: 'radius', points: [] as unknown[] }

jest.mock('@/stores/routeStore', () => ({
  useRouteStore: {
    getState: () => ({
      ...mockRouteStoreState,
      clearRouteAndSetMode: mockClearRouteAndSetMode,
    }),
  },
}))

jest.mock('@/hooks/map/useMapCoordinates', () => ({
  useMapCoordinates: () => ({
    coordinates: { latitude: 53.9, longitude: 27.5667 },
    coordinatesSource: 'default',
    coordinatesAreFallback: true,
    locationState: { status: 'unavailable' },
    currentLocation: null,
    error: null,
    refreshLocation: jest.fn(),
    openLocationSettings: jest.fn(),
  }),
}))

jest.mock('@/hooks/map/useRouteController', () => ({
  useRouteController: () => ({
    mode: 'radius',
    setMode: jest.fn(),
    transportMode: 'car',
    setTransportMode: jest.fn(),
    routePoints: [],
    routeStorePoints: [],
    startAddress: null,
    endAddress: null,
    routeDistance: null,
    routeDuration: null,
    routeElevationGain: null,
    routeElevationLoss: null,
    fullRouteCoords: [],
    setRoutePoints: jest.fn(),
    setRouteDistance: jest.fn(),
    setRouteDuration: jest.fn(),
    setFullRouteCoords: jest.fn(),
    setRouteElevationStats: jest.fn(),
    handleClearRoute: jest.fn(),
    handleAddressSelect: jest.fn(),
    handleAddressClear: jest.fn(),
    onRemoveRoutePoint: jest.fn(),
    swapStartEnd: jest.fn(),
    routingLoading: false,
    routingError: null,
    setRoutingLoading: jest.fn(),
    setRoutingError: jest.fn(),
    handleMapClick: jest.fn(),
    buildRouteTo: jest.fn(),
    addRoutePointFromTravel: mockAddRoutePointFromTravel,
    focusPlace: jest.fn(),
  }),
}))

jest.mock('@/hooks/map/useSearchThisArea', () => ({
  useSearchThisArea: () => ({
    searchAreaCenter: null,
    setSearchAreaCenter: mockSetSearchAreaCenter,
    canSearchThisArea: false,
    handleMapMove: jest.fn(),
    handleSearchThisArea: jest.fn(),
  }),
}))

jest.mock('@/hooks/map/useMapDataController', () => ({
  useMapDataController: (opts: { coordinates: unknown }) => ({
    __receivedCoordinates: opts.coordinates,
    allTravelsData: [],
    travelsData: [],
    total: 0,
    loading: false,
    isFetching: false,
    isPlaceholderData: false,
    mapError: null,
    mapErrorDetails: null,
    refetchMapData: jest.fn(),
    invalidateTravelsQuery: jest.fn(),
    hasMore: false,
    onLoadMore: jest.fn(),
    isFetchingNextPage: false,
    isDebouncingFilters: false,
  }),
}))

import { useMapController } from '@/components/map-core/useMapController'

const baseParams = {
  isMobile: false,
  isFocused: true,
  filters: { categories: [], categoryTravelAddress: [], radius: [], address: [] } as any,
  filterValues: {
    categories: [],
    categoryTravelAddress: [],
    radius: '60',
    address: '',
    searchQuery: '',
  } as any,
  urlCoordinates: null,
  urlSelectedPlace: null,
}

describe('useMapController (#991 smoke)', () => {
  beforeEach(() => {
    mockSetSearchAreaCenter.mockClear()
    mockClearRouteAndSetMode.mockClear()
    mockAddRoutePointFromTravel.mockClear()
    mockRouteStoreState = { mode: 'radius', points: [] }
  })

  it('mapPanelProps несёт единый контракт рендер-адаптеров', () => {
    const { result } = renderHook(() => useMapController(baseParams))
    const props = result.current.mapPanelProps
    for (const key of [
      'travelsData', 'coordinates', 'coordinatesAreFallback', 'userLocation',
      'routePoints', 'fullRouteCoords', 'mode', 'transportMode', 'radius',
      'mapClusterFilters', 'categoryFilterUnresolved', 'setRoutePoints',
      'onMapClick', 'onMapUiApiReady', 'onRequestUserLocation', 'onMapMove',
      'suppressLeafletPopupOnSelect',
    ]) {
      expect(props).toHaveProperty(key)
    }
    // #207 — desktop: без mobile-гейтов
    expect(props.onMarkerSelect).toBeUndefined()
    expect(props.onMapBackgroundTap).toBeUndefined()
    expect(props.suppressLeafletPopupOnSelect).toBe(false)
  })

  it('#207 — isMobile включает marker-select/background-tap гейты', () => {
    const { result } = renderHook(() => useMapController({ ...baseParams, isMobile: true }))
    const props = result.current.mapPanelProps
    expect(typeof props.onMarkerSelect).toBe('function')
    expect(typeof props.onMapBackgroundTap).toBe('function')
    expect(props.suppressLeafletPopupOnSelect).toBe(true)
  })

  it('F-49 precedence: URL-якорь побеждает resolved-координаты и помечается fallback', () => {
    const url = { latitude: 50.06, longitude: 19.94 }
    const { result } = renderHook(() =>
      useMapController({ ...baseParams, urlCoordinates: url }),
    )
    expect(result.current.mapPanelProps.coordinates).toEqual(url)
    // URL-якорь — viewport-позиция, не доверенный fix пользователя
    expect(result.current.mapPanelProps.coordinatesAreFallback).toBe(true)
  })

  it('без якорей запрос идёт от resolved-координат', () => {
    const { result } = renderHook(() => useMapController(baseParams))
    expect(result.current.mapPanelProps.coordinates).toEqual({
      latitude: 53.9,
      longitude: 27.5667,
    })
  })

  it('#FIX-2 — тап маркера кормит маршрут только пока в нём <2 точек', () => {
    mockRouteStoreState = { mode: 'route', points: [{}] }
    const { result } = renderHook(() => useMapController({ ...baseParams, isMobile: true }))
    const point = { id: '7', coord: '53.9,27.5', address: 'X' } as any

    act(() => { result.current.mapPanelProps.onMarkerSelect?.(point) })
    expect(mockAddRoutePointFromTravel).toHaveBeenCalledWith(point)
    expect(result.current.selectedPlace).toBeNull()

    // Достроенный 2-точечный маршрут отпускает тап → открывается карточка места
    mockAddRoutePointFromTravel.mockClear()
    mockRouteStoreState = { mode: 'route', points: [{}, {}] }
    act(() => { result.current.mapPanelProps.onMarkerSelect?.(point) })
    expect(mockAddRoutePointFromTravel).not.toHaveBeenCalled()
    expect(result.current.selectedPlace).toEqual(point)
  })

  it('resetCoreForFilters сбрасывает search-area якорь и маршрут атомарно', () => {
    const { result } = renderHook(() => useMapController(baseParams))
    act(() => { result.current.resetCoreForFilters() })
    expect(mockSetSearchAreaCenter).toHaveBeenCalledWith(null)
    expect(mockClearRouteAndSetMode).toHaveBeenCalledWith('radius')
  })
})
