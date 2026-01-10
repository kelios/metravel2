import { renderHook, act } from '@testing-library/react-native'

const mockUpdateCoordinates = jest.fn()

jest.mock('expo-router', () => ({
  usePathname: () => '/map',
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock('@/hooks/map', () => ({
  useMapResponsive: () => ({ isMobile: false, width: 1200 }),
  useMapPanelState: () => ({
    isFocused: true,
    mapReady: true,
    rightPanelTab: 'list',
    rightPanelVisible: true,
    selectFiltersTab: jest.fn(),
    selectTravelsTab: jest.fn(),
    openRightPanel: jest.fn(),
    closeRightPanel: jest.fn(),
    panelStyle: {},
    overlayStyle: {},
    filtersTabRef: { current: null },
    panelRef: { current: null },
  }),
  useMapCoordinates: () => ({
    coordinates: { latitude: 53.9, longitude: 27.5667 },
    updateCoordinates: mockUpdateCoordinates,
  }),
  useMapFilters: () => ({
    filters: { categories: [], radius: [], address: [] },
    filterValues: { radius: '60' },
    handleFilterChangeForPanel: jest.fn(),
    resetFilters: jest.fn(),
  }),
  useMapTravels: () => ({
    allTravelsData: [],
    filteredTravelsData: [],
    isLoading: false,
    isFetching: false,
    isPlaceholderData: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
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
    border: '#ddd',
  }),
}))

jest.mock('@/app/(tabs)/map.styles', () => ({
  getStyles: () => ({}),
}))

jest.mock('@/src/utils/logger', () => ({
  logMessage: jest.fn(),
}))

jest.mock('@/src/utils/mapFiltersStorage', () => ({
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
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('focuses map and opens popup without updating global coordinates (prevents zoom reset)', async () => {
    const { result } = renderHook(() => useMapScreenController())

    const focusOnCoord = jest.fn()
    const openPopupForCoord = jest.fn()

    // Attach MapUiApi to controller
    act(() => {
      result.current.mapPanelProps.onMapUiApiReady({
        focusOnCoord,
        openPopupForCoord,
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
    })

    act(() => {
      result.current.buildRouteTo({ coord: '50.0619474, 19.9368564' } as any)
    })

    expect(focusOnCoord).toHaveBeenCalledWith('50.0619474, 19.9368564', { zoom: 14 })

    // openPopupForCoord is scheduled with a timeout
    act(() => {
      jest.advanceTimersByTime(420)
    })

    expect(openPopupForCoord).toHaveBeenCalledWith('50.0619474, 19.9368564')

    // Critical regression guard: we must not update global search coordinates
    expect(mockUpdateCoordinates).not.toHaveBeenCalled()
  })
})
