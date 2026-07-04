import React from 'react'
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useMapClusters } from '@/hooks/map/useMapClusters'
import type { MapClustersResult } from '@/api/map'

const mockFetchMapClusters = jest.fn()

jest.mock('@/api/map', () => ({
  __esModule: true,
  fetchMapClusters: (...args: any[]) => mockFetchMapClusters(...args),
}))

const RESULT: MapClustersResult = {
  clusters: [
    {
      id: 'abc',
      center: { lat: 53.9, lng: 27.5 },
      count: 12,
      bounds: { south: 53.8, west: 27.4, north: 54.0, east: 27.6 },
      previewItems: [],
    },
  ],
  markers: [],
  totalCount: 12,
  source: 'travel_addresses',
  generatedAt: '',
}

const BBOX = { south: 53.5, west: 26.5, north: 54.3, east: 28.5 }

const makeWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe('useMapClusters', () => {
  beforeEach(() => {
    mockFetchMapClusters.mockReset()
    mockFetchMapClusters.mockResolvedValue(RESULT)
  })

  it('fetches clusters for a valid bbox/zoom after debounce', async () => {
    const { result } = renderHook(
      () => useMapClusters({ bbox: BBOX, zoom: 9, debounceMs: 0 }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(mockFetchMapClusters).toHaveBeenCalled())
    await waitFor(() => expect(result.current.data.clusters).toHaveLength(1))
    expect(result.current.data.totalCount).toBe(12)

    const [bboxArg, zoomArg] = mockFetchMapClusters.mock.calls[0]
    expect(zoomArg).toBe(9)
    expect(bboxArg.south).toBeCloseTo(53.5)
  })

  it('passes radius anchor filters to the cluster endpoint', async () => {
    renderHook(
      () =>
        useMapClusters({
          bbox: BBOX,
          zoom: 9,
          filters: { lat: 53.9, lng: 27.56, radius: 10 },
          debounceMs: 0,
        }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(mockFetchMapClusters).toHaveBeenCalled())
    expect(mockFetchMapClusters.mock.calls[0]?.[2]).toEqual(
      expect.objectContaining({ lat: 53.9, lng: 27.56, radius: 10 }),
    )
  })

  it('does not fetch when bbox is null (fallback to local clustering)', async () => {
    renderHook(() => useMapClusters({ bbox: null, zoom: 9, debounceMs: 0 }), {
      wrapper: makeWrapper(),
    })
    await new Promise((r) => setTimeout(r, 30))
    expect(mockFetchMapClusters).not.toHaveBeenCalled()
  })

  it('does not fetch when bbox is invalid (south >= north)', async () => {
    renderHook(
      () => useMapClusters({ bbox: { south: 55, west: 27, north: 54, east: 28 }, zoom: 9, debounceMs: 0 }),
      { wrapper: makeWrapper() },
    )
    await new Promise((r) => setTimeout(r, 30))
    expect(mockFetchMapClusters).not.toHaveBeenCalled()
  })

  it('does not fetch when disabled or not focused', async () => {
    renderHook(
      () => useMapClusters({ bbox: BBOX, zoom: 9, enabled: false, debounceMs: 0 }),
      { wrapper: makeWrapper() },
    )
    renderHook(
      () => useMapClusters({ bbox: BBOX, zoom: 9, isFocused: false, debounceMs: 0 }),
      { wrapper: makeWrapper() },
    )
    await new Promise((r) => setTimeout(r, 30))
    expect(mockFetchMapClusters).not.toHaveBeenCalled()
  })

  it('surfaces isError without throwing when the endpoint rejects', async () => {
    mockFetchMapClusters.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(
      () => useMapClusters({ bbox: BBOX, zoom: 9, debounceMs: 0 }),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(result.current.isError).toBe(true))
    // Empty result keeps the render path safe for local fallback.
    expect(result.current.data.clusters).toEqual([])
  })
})
