import { renderHook, act } from '@testing-library/react-native'

const mockUpdateCoordinates = jest.fn()
const mockRefreshLocation = jest.fn()
const mockBuildRouteTo = jest.fn()
const mockUseRouteController = jest.fn()
const mockSearchParams: Record<string, string> = {}
const mockMapCoordinatesState: Record<string, any> = {
  coordinates: { latitude: 53.9, longitude: 27.5667 },
  coordinatesSource: 'default',
  coordinatesAreFallback: true,
  currentLocation: null,
  locationState: {
    status: 'denied',
    coordinates: null,
    accuracy: null,
    timestamp: null,
    canAskAgain: true,
  },
  updateCoordinates: mockUpdateCoordinates,
  refreshLocation: mockRefreshLocation,
  openLocationSettings: jest.fn(),
}

jest.mock('expo-router', () => ({
  usePathname: () => '/map',
  useLocalSearchParams: () => mockSearchParams,
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock('@/hooks/map/useMapCoordinates', () => ({
  useMapCoordinates: () => mockMapCoordinatesState,
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
    rightPanelVisible: true,
    isDesktopCollapsed: false,
    desktopPanelWidth: 384,
    selectFiltersTab: jest.fn(),
    selectTravelsTab: jest.fn(),
    openRightPanel: jest.fn(),
    closeRightPanel: jest.fn(),
    toggleDesktopCollapse: jest.fn(),
    onResizePanelWidth: jest.fn(),
    panelStyle: {},
    overlayStyle: {},
    filtersTabRef: { current: null },
    panelRef: { current: null },
  }),
}))

jest.mock('@/hooks/useSafeAreaInsetsSafe', () => ({
  useSafeAreaInsetsSafe: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock('@/hooks/map/useMapDataController', () => ({
  useMapDataController: () => ({
    allTravelsData: [],
    travelsData: [],
    loading: false,
    isFetching: false,
    isPlaceholderData: false,
    mapError: null,
    mapErrorDetails: null,
    refetchMapData: jest.fn(),
    invalidateTravelsQuery: jest.fn(),
  }),
}))

jest.mock('@/hooks/map/useRouteController', () => ({
  useRouteController: (options: any) => mockUseRouteController(options),
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
    border: '#ddd',
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

import { useMapScreenController } from '@/hooks/useMapScreenController'

describe('useMapScreenController.buildRouteTo', () => {
  beforeEach(() => {
    mockUpdateCoordinates.mockClear()
    mockRefreshLocation.mockClear()
    Object.keys(mockSearchParams).forEach((key) => delete mockSearchParams[key])
    Object.assign(mockMapCoordinatesState, {
      coordinates: { latitude: 53.9, longitude: 27.5667 },
      coordinatesSource: 'default',
      coordinatesAreFallback: true,
      currentLocation: null,
      locationState: {
        status: 'denied',
        coordinates: null,
        accuracy: null,
        timestamp: null,
        canAskAgain: true,
      },
    })
    mockUseRouteController.mockClear()
    mockUseRouteController.mockReturnValue({
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
      setRoutingLoading: jest.fn(),
      setRoutingError: jest.fn(),
      routingLoading: false,
      routingError: null,
      handleMapClick: jest.fn(),
      buildRouteTo: mockBuildRouteTo,
      handleClearRoute: jest.fn(),
      handleAddressSelect: jest.fn(),
      handleAddressClear: jest.fn(),
      onRemoveRoutePoint: jest.fn(),
      swapStartEnd: jest.fn(),
      addRoutePointFromTravel: jest.fn(),
      focusPlace: jest.fn(),
    })
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('focuses map and opens popup without updating global coordinates (prevents zoom reset)', async () => {
    const { result } = renderHook(() => useMapScreenController())

    act(() => {
      result.current.buildRouteTo({ coord: '50.0619474, 19.9368564' } as any)
    })

    expect(mockBuildRouteTo).toHaveBeenCalled()

    // Critical regression guard: we must not update global search coordinates
    expect(mockUpdateCoordinates).not.toHaveBeenCalled()
  })

  it('does not pass fallback viewport coordinates as route origin', () => {
    renderHook(() => useMapScreenController())

    expect(mockUseRouteController).toHaveBeenCalledWith(
      expect.objectContaining({
        originCoordinates: null,
      }),
    )
  })

  it('keeps following live location after recenter until the user moves the map', async () => {
    const centerOnUser = jest.fn()
    const { result, rerender } = renderHook(() => useMapScreenController())

    act(() => {
      result.current.mapPanelProps.onMapUiApiReady?.({
        centerOnUser,
        zoomIn: jest.fn(),
        zoomOut: jest.fn(),
        fitToResults: jest.fn(),
        exportGpx: jest.fn(),
        exportKml: jest.fn(),
        setBaseLayer: jest.fn(),
        setOverlayEnabled: jest.fn(),
        capabilities: {
          canCenterOnUser: true,
          canFitToResults: true,
          canExportRoute: false,
        },
      })
    })

    act(() => {
      result.current.centerOnUser()
    })
    expect(mockRefreshLocation).toHaveBeenCalledTimes(1)
    expect(centerOnUser).not.toHaveBeenCalled()

    act(() => {
      Object.assign(mockMapCoordinatesState, {
        coordinates: { latitude: 52.2, longitude: 20.98 },
        coordinatesSource: 'geolocation',
        coordinatesAreFallback: false,
        currentLocation: { latitude: 52.2, longitude: 20.98 },
        locationState: {
          status: 'current',
          coordinates: { latitude: 52.2, longitude: 20.98 },
          accuracy: 8,
          timestamp: 1000,
          canAskAgain: true,
        },
      })
      rerender()
    })
    expect(centerOnUser).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.mapPanelProps.onMapMove?.({
        latitude: 52.201,
        longitude: 20.981,
        userInitiated: true,
      })
      Object.assign(mockMapCoordinatesState, {
        coordinates: { latitude: 52.202, longitude: 20.982 },
        currentLocation: { latitude: 52.202, longitude: 20.982 },
        locationState: {
          status: 'current',
          coordinates: { latitude: 52.202, longitude: 20.982 },
          accuracy: 7,
          timestamp: 2000,
          canAskAgain: true,
        },
      })
      rerender()
    })
    expect(centerOnUser).toHaveBeenCalledTimes(1)
  })

  it('keeps URL coordinates as viewport-only while routing from the trusted current fix', () => {
    Object.assign(mockSearchParams, { lat: '48.8566', lng: '2.3522' })
    Object.assign(mockMapCoordinatesState, {
      coordinates: { latitude: 52.2, longitude: 20.98 },
      coordinatesSource: 'geolocation',
      coordinatesAreFallback: false,
      currentLocation: { latitude: 52.2, longitude: 20.98 },
      locationState: {
        status: 'current',
        coordinates: { latitude: 52.2, longitude: 20.98 },
        accuracy: 8,
        timestamp: 1000,
        canAskAgain: true,
      },
    })

    const { result } = renderHook(() => useMapScreenController())

    expect(mockUseRouteController).toHaveBeenCalledWith(
      expect.objectContaining({
        originCoordinates: { latitude: 52.2, longitude: 20.98 },
      }),
    )
    expect(result.current.mapPanelProps).toEqual(expect.objectContaining({
      coordinates: { latitude: 48.8566, longitude: 2.3522 },
      coordinatesAreFallback: true,
      userLocation: { latitude: 52.2, longitude: 20.98 },
    }))
  })
})
