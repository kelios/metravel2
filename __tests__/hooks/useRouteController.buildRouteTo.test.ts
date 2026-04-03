import { act, renderHook } from '@testing-library/react-native'

const mockRequestCollapse = jest.fn()
const mockFocusOnCoord = jest.fn()
const mockOpenPopupForCoord = jest.fn()

let mockBottomSheetState: 'collapsed' | 'quarter' | 'half' | 'full' = 'half'

jest.mock('@/stores/bottomSheetStore', () => ({
  useBottomSheetStore: {
    getState: () => ({
      state: mockBottomSheetState,
      requestCollapse: mockRequestCollapse,
    }),
  },
}))

jest.mock('@/hooks/useRouteStoreAdapter', () => ({
  useRouteStoreAdapter: () => ({
    mode: 'radius',
    setMode: jest.fn(),
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
    addPoint: jest.fn(),
    updatePoint: jest.fn(),
    removePoint: jest.fn(),
    swapStartEnd: jest.fn(),
    clearRoute: jest.fn(),
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
    mockFocusOnCoord.mockClear()
    mockOpenPopupForCoord.mockClear()
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

    expect(mockRequestCollapse).toHaveBeenCalledTimes(1)
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
