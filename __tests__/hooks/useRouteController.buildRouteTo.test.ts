import { act, renderHook } from '@testing-library/react-native'

const mockRequestCollapse = jest.fn()
const mockRequestPanelCollapse = jest.fn()
const mockFocusOnCoord = jest.fn()
const mockOpenPopupForCoord = jest.fn()
const mockSetMode = jest.fn()
const mockClearRoute = jest.fn()
const mockAddPoint = jest.fn()

let mockBottomSheetState: 'collapsed' | 'quarter' | 'half' | 'full' = 'half'

jest.mock('@/stores/bottomSheetStore', () => ({
  useBottomSheetStore: {
    getState: () => ({
      state: mockBottomSheetState,
      requestCollapse: mockRequestCollapse,
    }),
  },
}))

jest.mock('@/stores/mapPanelStore', () => ({
  useMapPanelStore: {
    getState: () => ({
      requestCollapse: mockRequestPanelCollapse,
    }),
  },
}))

jest.mock('@/hooks/useRouteStoreAdapter', () => ({
  useRouteStoreAdapter: () => ({
    mode: 'radius',
    setMode: mockSetMode,
    transportMode: 'car',
    setTransportMode: jest.fn(),
    routePoints: [],
    startAddress: '',
    endAddress: '',
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
    points: [],
    isBuilding: false,
    error: null,
    setBuilding: jest.fn(),
    setError: jest.fn(),
    addPoint: mockAddPoint,
    updatePoint: jest.fn(),
    removePoint: jest.fn(),
    swapStartEnd: jest.fn(),
    clearRoute: mockClearRoute,
  }),
}))

jest.mock('@/stores/routeStore', () => ({
  useRouteStore: {
    getState: () => ({
      points: [],
    }),
  },
}))

jest.mock('@/utils/logger', () => ({
  logMessage: jest.fn(),
}))

jest.mock('@/utils/mapToasts', () => ({
  showRoutePointAddedToast: jest.fn(),
}))

import { useRouteController } from '@/hooks/map/useRouteController'

describe('useRouteController.buildRouteTo', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockBottomSheetState = 'half'
    mockRequestCollapse.mockClear()
    mockRequestPanelCollapse.mockClear()
    mockFocusOnCoord.mockClear()
    mockOpenPopupForCoord.mockClear()
    mockSetMode.mockClear()
    mockClearRoute.mockClear()
    mockAddPoint.mockClear()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('collapses the mobile bottom sheet before opening a popup for the target point', () => {
    const { result } = renderHook(() =>
      useRouteController({
        mapUiApi: {
          focusOnCoord: mockFocusOnCoord,
          openPopupForCoord: mockOpenPopupForCoord,
        } as any,
      })
    )

    act(() => {
      result.current.buildRouteTo({ coord: '50.0619474, 19.9368564' } as any)
    })

    expect(mockRequestPanelCollapse).toHaveBeenCalledTimes(1)
    expect(mockFocusOnCoord).toHaveBeenCalledWith('50.061947,19.936856', { zoom: 14 })

    act(() => {
      jest.advanceTimersByTime(519)
    })
    expect(mockOpenPopupForCoord).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(mockOpenPopupForCoord).toHaveBeenCalledWith('50.0619474,19.9368564')
    expect(mockOpenPopupForCoord).toHaveBeenCalledWith('50.0619474, 19.9368564')
    expect(mockOpenPopupForCoord).toHaveBeenCalledWith('50.061947,19.936856')
  })

  it('switches to route mode and creates start/end points from origin to swiped place', () => {
    const { result } = renderHook(() =>
      useRouteController({
        originCoordinates: { latitude: 53.9, longitude: 27.5667 },
        mapUiApi: {
          focusOnCoord: mockFocusOnCoord,
          openPopupForCoord: mockOpenPopupForCoord,
        } as any,
      })
    )

    act(() => {
      result.current.buildRouteTo({
        coord: '50.0619474, 19.9368564',
        address: 'Krakow place',
      } as any)
    })

    expect(mockSetMode).toHaveBeenCalledWith('route')
    expect(mockClearRoute).toHaveBeenCalledTimes(1)
    expect(mockAddPoint).toHaveBeenNthCalledWith(
      1,
      { lat: 53.9, lng: 27.5667 },
      'Мое местоположение',
    )
    expect(mockAddPoint).toHaveBeenNthCalledWith(
      2,
      { lat: 50.0619474, lng: 19.9368564 },
      'Krakow place',
    )
  })

  it('does not request collapse when the bottom sheet is already collapsed', () => {
    mockBottomSheetState = 'collapsed'

    const { result } = renderHook(() =>
      useRouteController({
        mapUiApi: {
          focusOnCoord: mockFocusOnCoord,
          openPopupForCoord: mockOpenPopupForCoord,
        } as any,
      })
    )

    act(() => {
      result.current.buildRouteTo({ coord: '50.0619474, 19.9368564' } as any)
      jest.advanceTimersByTime(420)
    })

    expect(mockRequestCollapse).not.toHaveBeenCalled()
    expect(mockOpenPopupForCoord).toHaveBeenCalled()
  })
})
