import { renderHook, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { useRouteFilePreviews } from '@/hooks/useRouteFilePreviews'

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: jest.fn(() => ({
    primary: '#111',
    info: '#222',
    success: '#333',
    warning: '#444',
    accent: '#555',
    primaryDark: '#666',
    infoDark: '#777',
    successDark: '#888',
    warningDark: '#999',
    accentDark: '#aaa',
  })),
}))

jest.mock('@/hooks/useTravelRouteFiles', () => ({
  useTravelRouteFiles: jest.fn(() => ({
    data: [],
    isLoading: false,
    isFetching: false,
  })),
}))

jest.mock('@/api/travelRoutes', () => ({
  downloadTravelRouteFileBlob: jest.fn(),
}))

jest.mock('@/utils/routeFileParser', () => ({
  buildElevationProfile: jest.fn(() => []),
  parseRouteFileGeometry: jest.fn(() => ({
    hasIndependentPoints: false,
    lines: [],
    points: [],
  })),
  // Identity for these clean-track fixtures; the real fn only strips teleport
  // fragments, which none of these previews contain.
  sanitizeRoutePreview: jest.fn((preview) => preview),
}))

const { useTravelRouteFiles } = jest.requireMock('@/hooks/useTravelRouteFiles') as {
  useTravelRouteFiles: jest.Mock
}
const { downloadTravelRouteFileBlob } = jest.requireMock('@/api/travelRoutes') as {
  downloadTravelRouteFileBlob: jest.Mock
}
const { buildElevationProfile, parseRouteFileGeometry } = jest.requireMock('@/utils/routeFileParser') as {
  buildElevationProfile: jest.Mock
  parseRouteFileGeometry: jest.Mock
}

describe('useRouteFilePreviews', () => {
  const originalPlatform = Platform.OS

  beforeEach(() => {
    jest.clearAllMocks()
    ;(Platform as any).OS = 'web'
    useTravelRouteFiles.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
    })
    parseRouteFileGeometry.mockReturnValue({
      hasIndependentPoints: false,
      lines: [],
      points: [],
    })
    buildElevationProfile.mockReturnValue([])
  })

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
  })

  it('enables route files query on web before the map is opened when travel id exists', () => {
    renderHook(() =>
      useRouteFilePreviews({
        travelId: 528,
        canRenderHeavy: true,
        shouldRender: false,
        shouldForceRenderMap: false,
      }),
    )

    expect(useTravelRouteFiles).toHaveBeenCalledWith(528, {
      enabled: true,
    })
  })

  it('reports loading while route files request is still in flight', () => {
    useTravelRouteFiles.mockReturnValue({
      data: [],
      isLoading: true,
      isFetching: false,
    })

    const { result } = renderHook(() =>
      useRouteFilePreviews({
        travelId: 528,
        canRenderHeavy: true,
        shouldRender: false,
        shouldForceRenderMap: false,
      }),
    )

    expect(result.current.isRoutePreviewLoading).toBe(true)
  })

  it('uses server preview only after source XML confirms a line-only file', async () => {
    const serverPreview = {
      linePoints: [
        { coord: '49.28,19.84', elevation: 905 },
        { coord: '49.24,19.79', elevation: 1145 },
      ],
      elevationProfile: [
        { distanceKm: 0, elevationM: 905 },
        { distanceKm: 7.48, elevationM: 1145 },
      ],
    }
    useTravelRouteFiles.mockReturnValue({
      data: [
        {
          id: 18,
          original_name: 'route.gpx',
          ext: 'gpx',
          preview: serverPreview,
        },
      ],
      isLoading: false,
      isFetching: false,
    })
    downloadTravelRouteFileBlob.mockResolvedValue({ text: '<gpx/>' })
    parseRouteFileGeometry.mockReturnValue({
      hasIndependentPoints: false,
      lines: [serverPreview.linePoints],
      points: [],
    })

    const { result } = renderHook(() =>
      useRouteFilePreviews({
        travelId: 563,
        canRenderHeavy: true,
        shouldRender: true,
        shouldForceRenderMap: false,
      }),
    )

    await waitFor(() => {
      expect(result.current.primaryRoutePreview).toEqual(serverPreview)
    })
    expect(downloadTravelRouteFileBlob).toHaveBeenCalledWith(563, 18)
    expect(parseRouteFileGeometry).toHaveBeenCalledWith('<gpx/>', 'gpx')
  })

  it('falls back to download+parse when the server preview is absent (old deployments)', async () => {
    const parsedPreview = {
      linePoints: [
        { coord: '49.28,19.84', elevation: 905 },
        { coord: '49.24,19.79', elevation: 1145 },
      ],
      elevationProfile: [
        { distanceKm: 0, elevationM: 905 },
        { distanceKm: 7.48, elevationM: 1145 },
      ],
    }
    useTravelRouteFiles.mockReturnValue({
      data: [{ id: 18, original_name: 'route.gpx', ext: 'gpx' }],
      isLoading: false,
      isFetching: false,
    })
    downloadTravelRouteFileBlob.mockResolvedValue({ text: '<gpx/>' })
    parseRouteFileGeometry.mockReturnValue({
      hasIndependentPoints: false,
      lines: [parsedPreview.linePoints],
      points: [],
    })
    buildElevationProfile.mockReturnValue(parsedPreview.elevationProfile)

    const { result } = renderHook(() =>
      useRouteFilePreviews({
        travelId: 563,
        canRenderHeavy: true,
        shouldRender: true,
        shouldForceRenderMap: false,
      }),
    )

    await waitFor(() => {
      expect(result.current.primaryRoutePreview).toEqual(parsedPreview)
    })
    expect(downloadTravelRouteFileBlob).toHaveBeenCalledWith(563, 18)
  })

  it('turns a point-only file into named markers and ignores a false server line', async () => {
    const falseServerPreview = {
      linePoints: [{ coord: '50.01,19.81' }, { coord: '50.02,19.82' }],
      elevationProfile: [
        { distanceKm: 0, elevationM: 0 },
        { distanceKm: 250, elevationM: 0 },
      ],
    }
    useTravelRouteFiles.mockReturnValue({
      data: [
        {
          id: 31,
          original_name: 'parks.kml',
          ext: 'kml',
          preview: falseServerPreview,
        },
      ],
      isLoading: false,
      isFetching: false,
    })
    downloadTravelRouteFileBlob.mockResolvedValue({ text: '<kml/>' })
    parseRouteFileGeometry.mockReturnValue({
      hasIndependentPoints: true,
      lines: [],
      points: [
        { coord: '50.01,19.81', name: 'Park 1' },
        { coord: '50.02,19.82', name: 'Park 2' },
      ],
    })

    const { result } = renderHook(() =>
      useRouteFilePreviews({
        travelId: 737,
        canRenderHeavy: true,
        shouldRender: true,
        shouldForceRenderMap: false,
      }),
    )

    await waitFor(() => {
      expect(result.current.routeFilePoints).toHaveLength(2)
    })
    expect(result.current.routeFilePoints).toEqual([
      { id: 'route-file-31-point-0', coord: '50.01,19.81', name: 'Park 1' },
      { id: 'route-file-31-point-1', coord: '50.02,19.82', name: 'Park 2' },
    ])
    expect(result.current.routePreviewItems).toEqual([])
    expect(result.current.primaryRoutePreview).toBeNull()
  })

  it('uses source lines for a mixed file so independent points never enter the route', async () => {
    const contaminatedServerPreview = {
      linePoints: [{ coord: '50,19' }, { coord: '52.1,23.7' }, { coord: '52.2,23.8' }],
      elevationProfile: [],
    }
    const sourceLine = [{ coord: '52.1,23.7' }, { coord: '52.2,23.8' }]
    useTravelRouteFiles.mockReturnValue({
      data: [
        {
          id: 32,
          original_name: 'mixed.gpx',
          ext: 'gpx',
          preview: contaminatedServerPreview,
        },
      ],
      isLoading: false,
      isFetching: false,
    })
    downloadTravelRouteFileBlob.mockResolvedValue({ text: '<gpx/>' })
    parseRouteFileGeometry.mockReturnValue({
      hasIndependentPoints: true,
      lines: [sourceLine],
      points: [{ coord: '50,19', name: 'POI' }],
    })

    const { result } = renderHook(() =>
      useRouteFilePreviews({
        travelId: 738,
        canRenderHeavy: true,
        shouldRender: true,
        shouldForceRenderMap: false,
      }),
    )

    await waitFor(() => {
      expect(result.current.primaryRoutePreview?.linePoints).toEqual(sourceLine)
    })
    expect(result.current.primaryRoutePreview?.linePoints).not.toEqual(contaminatedServerPreview.linePoints)
    expect(result.current.routeFilePoints).toHaveLength(1)
  })

  it('disqualifies the server preview for an unnamed structural point', async () => {
    const serverPreview = {
      linePoints: [{ coord: '50,19' }, { coord: '52.1,23.7' }, { coord: '52.2,23.8' }],
      elevationProfile: [],
    }
    const sourceLine = [{ coord: '52.1,23.7' }, { coord: '52.2,23.8' }]
    useTravelRouteFiles.mockReturnValue({
      data: [
        {
          id: 33,
          original_name: 'unnamed-point.gpx',
          ext: 'gpx',
          preview: serverPreview,
        },
      ],
      isLoading: false,
      isFetching: false,
    })
    downloadTravelRouteFileBlob.mockResolvedValue({ text: '<gpx/>' })
    parseRouteFileGeometry.mockReturnValue({
      hasIndependentPoints: true,
      lines: [sourceLine],
      points: [],
    })

    const { result } = renderHook(() =>
      useRouteFilePreviews({
        travelId: 739,
        canRenderHeavy: true,
        shouldRender: true,
        shouldForceRenderMap: false,
      }),
    )

    await waitFor(() => {
      expect(result.current.primaryRoutePreview?.linePoints).toEqual(sourceLine)
    })
    expect(result.current.primaryRoutePreview?.linePoints).not.toEqual(serverPreview.linePoints)
    expect(result.current.routeFilePoints).toEqual([])
  })
})
