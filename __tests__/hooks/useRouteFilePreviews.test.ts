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
  parseRouteFilePreviews: jest.fn(() => []),
}))

const { useTravelRouteFiles } = jest.requireMock('@/hooks/useTravelRouteFiles') as {
  useTravelRouteFiles: jest.Mock
}
const { downloadTravelRouteFileBlob } = jest.requireMock('@/api/travelRoutes') as {
  downloadTravelRouteFileBlob: jest.Mock
}
const { parseRouteFilePreviews } = jest.requireMock('@/utils/routeFileParser') as {
  parseRouteFilePreviews: jest.Mock
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
      })
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
      })
    )

    expect(result.current.isRoutePreviewLoading).toBe(true)
  })

  it('uses server-provided preview without downloading or parsing the route blob', async () => {
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
      data: [{ id: 18, original_name: 'route.gpx', ext: 'gpx', preview: serverPreview }],
      isLoading: false,
      isFetching: false,
    })

    const { result } = renderHook(() =>
      useRouteFilePreviews({
        travelId: 563,
        canRenderHeavy: true,
        shouldRender: true,
        shouldForceRenderMap: false,
      })
    )

    await waitFor(() => {
      expect(result.current.primaryRoutePreview).toEqual(serverPreview)
    })
    expect(downloadTravelRouteFileBlob).not.toHaveBeenCalled()
    expect(parseRouteFilePreviews).not.toHaveBeenCalled()
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
    parseRouteFilePreviews.mockReturnValue([parsedPreview])

    const { result } = renderHook(() =>
      useRouteFilePreviews({
        travelId: 563,
        canRenderHeavy: true,
        shouldRender: true,
        shouldForceRenderMap: false,
      })
    )

    await waitFor(() => {
      expect(result.current.primaryRoutePreview).toEqual(parsedPreview)
    })
    expect(downloadTravelRouteFileBlob).toHaveBeenCalledWith(563, 18)
  })
})
