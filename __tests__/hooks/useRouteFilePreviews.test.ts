import { renderHook } from '@testing-library/react-native'
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
})
