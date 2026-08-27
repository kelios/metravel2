import { renderHook } from '@testing-library/react-native'

import { useTravelRouteMapBlockModel } from '@/components/travel/details/hooks/useTravelRouteMapBlockModel'

const baseArgs = {
  downloadingRouteId: null,
  handleDownloadRoute: jest.fn(),
  hasMapData: true,
  isRoutePreviewLoading: false,
  keyPointLabels: undefined,
}

describe('useTravelRouteMapBlockModel', () => {
  it('maps point-only route files to markers without line or profile models', () => {
    const { result } = renderHook(() =>
      useTravelRouteMapBlockModel({
        ...baseArgs,
        routeFilePoints: [
          { id: 'route-file-31-point-0', coord: '50.01,19.81', name: 'Park 1' },
          { id: 'route-file-31-point-1', coord: '50.02,19.82', name: 'Park 2' },
        ],
        routePreviewItems: [],
      }),
    )

    expect(result.current.routeFileMarkers).toEqual([
      { id: 'route-file-31-point-0', coord: '50.01,19.81', address: 'Park 1' },
      { id: 'route-file-31-point-1', coord: '50.02,19.82', address: 'Park 2' },
    ])
    expect(result.current.routeLines).toEqual([])
    expect(result.current.routeProfiles).toEqual([])
    expect(result.current.shouldShowRouteLine).toBe(false)
  })

  it('keeps a confirmed track as a line and profile alongside independent markers', () => {
    const preview = {
      linePoints: [{ coord: '52.1,23.7' }, { coord: '52.2,23.8' }],
      elevationProfile: [],
    }
    const { result } = renderHook(() =>
      useTravelRouteMapBlockModel({
        ...baseArgs,
        routeFilePoints: [{ id: 'route-file-32-point-0', coord: '50,19', name: 'POI' }],
        routePreviewItems: [
          {
            file: { id: 32 },
            label: 'mixed.gpx',
            color: '#123456',
            preview,
          },
        ],
      }),
    )

    expect(result.current.routeFileMarkers).toHaveLength(1)
    expect(result.current.routeLines).toEqual([
      {
        color: '#123456',
        coords: [
          [52.1, 23.7],
          [52.2, 23.8],
        ],
      },
    ])
    expect(result.current.routeProfiles).toHaveLength(1)
    expect(result.current.shouldShowRouteLine).toBe(true)
  })
})
