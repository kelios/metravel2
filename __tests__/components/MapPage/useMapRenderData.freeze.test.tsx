import { renderHook } from '@testing-library/react-native'

// Freeze regression (#map-popup-instant-close): tapping a marker flies/zooms the
// map, which changes the viewport bbox/zoom → server-cluster refetch → markers
// remount → the just-opened Leaflet popup is destroyed. The place-layer data hook
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

import { useServerPlaceLayerData } from '@/components/MapPage/Map/useMapRenderData'

// #2451 — the cluster query lives in the leaf place-layer hook (inside the
// MapContainer), not in the page-level useMapRenderData.
const baseArgs = () => ({
  mapInstance: {},
  fallbackZoom: 11,
  mode: 'radius' as const,
  pointsOnly: false,
  canRenderMap: true,
  travelData: [],
  radiusCenter: { lat: 53.901, lng: 27.559 },
  radiusInMeters: 50000,
  categoryFilterUnresolved: false,
})

const lastEnabled = (): boolean => {
  const calls = mockUseMapClusters.mock.calls
  return (calls[calls.length - 1][0] as any).enabled
}

describe('useServerPlaceLayerData — server-cluster freeze while a popup is open', () => {
  beforeEach(() => mockUseMapClusters.mockClear())

  it('enables the cluster query by default (no popup open)', async () => {
    await renderHook(() => useServerPlaceLayerData({ ...baseArgs(), freezeServerClusters: false }))
    expect(lastEnabled()).toBe(true)
  })

  it('disables the cluster query while a popup is open (freeze)', async () => {
    await renderHook(() => useServerPlaceLayerData({ ...baseArgs(), freezeServerClusters: true }))
    expect(lastEnabled()).toBe(false)
  })

  it('re-enables the cluster query once the popup closes (unfreeze)', async () => {
    const { rerender } = await renderHook(
      (props: { freeze: boolean }) =>
        useServerPlaceLayerData({ ...baseArgs(), freezeServerClusters: props.freeze }),
      { initialProps: { freeze: true } },
    )
    expect(lastEnabled()).toBe(false)
    await rerender({ freeze: false })
    expect(lastEnabled()).toBe(true)
  })

  it('keeps the cluster query off outside radius mode and for points-only maps', async () => {
    await renderHook(() => useServerPlaceLayerData({ ...baseArgs(), mode: 'route' as const }))
    expect(lastEnabled()).toBe(false)
    await renderHook(() => useServerPlaceLayerData({ ...baseArgs(), pointsOnly: true }))
    expect(lastEnabled()).toBe(false)
  })
})
