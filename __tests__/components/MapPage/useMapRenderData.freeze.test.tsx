import { renderHook } from '@testing-library/react-native'

// Freeze regression (#map-popup-instant-close): tapping a marker flies/zooms the
// map, which changes the viewport bbox/zoom → server-cluster refetch → ClusterLayer
// remounts markers → the just-opened Leaflet popup is destroyed. useMapRenderData
// must disable the cluster query while a popup is open so the marker stays mounted.

// `mock`-prefixed so babel-jest allows it inside the hoisted jest.mock factory.
const mockUseMapClusters = jest.fn(() => ({
  data: { clusters: [], markers: [], totalCount: 0, source: '', generatedAt: '' },
  isLoading: false,
  isFetching: false,
  isError: false,
  isDebouncing: false,
}))

jest.mock('@/hooks/map/useMapClusters', () => ({
  useMapClusters: (params: any) => mockUseMapClusters(params),
}))

jest.mock('@/hooks/map/useMapViewportSnapshot', () => ({
  useMapViewportSnapshot: () => ({
    bbox: { south: 53.4, west: 27.0, north: 54.4, east: 28.1 },
    zoom: 11,
  }),
  readMapViewportSnapshot: () => ({ bbox: null, zoom: 11 }),
}))

jest.mock('@/components/MapPage/Map/useMapUserLocation', () => ({
  useMapUserLocation: () => ({ centerOnUserLocation: jest.fn(), userLocationLatLng: null }),
}))

import { useMapRenderData } from '@/components/MapPage/Map/useMapRenderData'

const baseArgs = () => ({
  travelData: [],
  safeCoordinates: { latitude: 53.9006, longitude: 27.559, zoom: 11 },
  coordinates: { latitude: 53.9006, longitude: 27.559 },
  mapRef: { current: {} } as any,
  markerByCoordRef: { current: new Map() } as any,
  mode: 'radius' as const,
  radius: '50',
  pointsOnly: false,
  mapInstance: {},
  leafletReady: true,
  leafletRuntimeReady: true,
  categoryFilterUnresolved: false,
})

const lastEnabled = (): boolean => {
  const calls = mockUseMapClusters.mock.calls
  return (calls[calls.length - 1][0] as any).enabled
}

describe('useMapRenderData — server-cluster freeze while a popup is open', () => {
  beforeEach(() => mockUseMapClusters.mockClear())

  it('enables the cluster query by default (no popup open)', () => {
    renderHook(() => useMapRenderData({ ...baseArgs(), freezeServerClusters: false }))
    expect(lastEnabled()).toBe(true)
  })

  it('disables the cluster query while a popup is open (freeze)', () => {
    renderHook(() => useMapRenderData({ ...baseArgs(), freezeServerClusters: true }))
    expect(lastEnabled()).toBe(false)
  })

  it('re-enables the cluster query once the popup closes (unfreeze)', () => {
    const { rerender } = renderHook(
      (props: { freeze: boolean }) =>
        useMapRenderData({ ...baseArgs(), freezeServerClusters: props.freeze }),
      { initialProps: { freeze: true } },
    )
    expect(lastEnabled()).toBe(false)
    rerender({ freeze: false })
    expect(lastEnabled()).toBe(true)
  })
})
