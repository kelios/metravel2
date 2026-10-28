import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useMapClusters } from '@/hooks/map/useMapClusters'
import {
  __resetProgrammaticMapMoveForTests,
  beginProgrammaticMapMove,
} from '@/components/MapPage/Map/programmaticMoveSignal'
import type { MapClustersResult } from '@/api/map'

const mockFetchMapClusters = jest.fn()

jest.mock('@/api/map', () => ({
  __esModule: true,
  fetchMapClusters: (...args: any[]) => mockFetchMapClusters(...args),
}))

const RESULT: MapClustersResult = {
  clusters: [],
  markers: [],
  totalCount: 0,
  source: 'travel_addresses',
  generatedAt: '',
}

const makeWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// #2450 — the cluster request contract shared by web and native renderers.
describe('useMapClusters request contract', () => {
  beforeEach(() => {
    mockFetchMapClusters.mockReset()
    mockFetchMapClusters.mockResolvedValue(RESULT)
    __resetProgrammaticMapMoveForTests()
  })

  it('keeps one queryKey for viewports inside the same tiles (no refetch on a small pan)', async () => {
    const wrapper = makeWrapper()
    const { rerender } = await renderHook(
      ({ bbox }) => useMapClusters({ bbox, zoom: 12, debounceMs: 0 }),
      { wrapper, initialProps: { bbox: { south: 53.86, west: 27.52, north: 53.94, east: 27.58 } } },
    )
    await waitFor(() => expect(mockFetchMapClusters).toHaveBeenCalledTimes(1))

    await rerender({ bbox: { south: 53.87, west: 27.53, north: 53.93, east: 27.57 } })
    await sleep(40)
    expect(mockFetchMapClusters).toHaveBeenCalledTimes(1)

    // The request bbox is the tile-grid box, not the raw viewport.
    const [bboxArg] = mockFetchMapClusters.mock.calls[0]
    expect(bboxArg.west).toBeLessThanOrEqual(27.52)
    expect(bboxArg.east).toBeGreaterThanOrEqual(27.58)
  })

  it('holds the request while a programmatic map move is in flight and fires once after it', async () => {
    const wrapper = makeWrapper()
    beginProgrammaticMapMove(120)
    const { result, rerender } = await renderHook(
      ({ bbox }) => useMapClusters({ bbox, zoom: 12, debounceMs: 0 }),
      { wrapper, initialProps: { bbox: { south: 53.86, west: 27.52, north: 53.94, east: 27.6 } } },
    )
    expect(result.current.isDebouncing).toBe(true)
    await sleep(40)
    expect(mockFetchMapClusters).not.toHaveBeenCalled()

    // The fit lands on a new viewport before the window closes.
    await rerender({ bbox: { south: 53.5, west: 27.0, north: 54.3, east: 28.1 } })
    await waitFor(() => expect(mockFetchMapClusters).toHaveBeenCalledTimes(1), { timeout: 1500 })
    const [bboxArg] = mockFetchMapClusters.mock.calls[0]
    expect(bboxArg.west).toBeLessThanOrEqual(27.0)
    await sleep(60)
    expect(mockFetchMapClusters).toHaveBeenCalledTimes(1)
  })

  it('on a radius change waits for the re-fitted viewport instead of fetching the old bbox', async () => {
    const wrapper = makeWrapper()
    const bbox = { south: 53.86, west: 27.52, north: 53.94, east: 27.6 }
    const { rerender } = await renderHook(
      ({ radius, bbox: nextBBox }) =>
        useMapClusters({
          bbox: nextBBox,
          zoom: 12,
          debounceMs: 0,
          filters: { lat: 53.9, lng: 27.56, radius },
        }),
      { wrapper, initialProps: { radius: 50, bbox } },
    )
    await waitFor(() => expect(mockFetchMapClusters).toHaveBeenCalledTimes(1))

    await rerender({ radius: 200, bbox })
    await sleep(60)
    // Old bbox + new radius is NOT requested.
    expect(mockFetchMapClusters).toHaveBeenCalledTimes(1)

    // The auto-fit publishes the wider viewport: exactly one request with the new radius.
    await act(async () => {
      await rerender({ radius: 200, bbox: { south: 52.2, west: 26.1, north: 55.6, east: 29.0 } })
    })
    await waitFor(() => expect(mockFetchMapClusters).toHaveBeenCalledTimes(2))
    expect(mockFetchMapClusters.mock.calls[1]?.[2]).toEqual(
      expect.objectContaining({ radius: 200 }),
    )
    expect(mockFetchMapClusters.mock.calls[1]?.[1]).toBe(12)
  })

  it('still fetches after the refit wait expires when the fit did not move the map', async () => {
    const wrapper = makeWrapper()
    const bbox = { south: 53.86, west: 27.52, north: 53.94, east: 27.6 }
    const { rerender } = await renderHook(
      ({ radius }) =>
        useMapClusters({
          bbox,
          zoom: 12,
          debounceMs: 0,
          filters: { lat: 53.9, lng: 27.56, radius },
        }),
      { wrapper, initialProps: { radius: 50 } },
    )
    await waitFor(() => expect(mockFetchMapClusters).toHaveBeenCalledTimes(1))
    await rerender({ radius: 25 })
    await waitFor(() => expect(mockFetchMapClusters).toHaveBeenCalledTimes(2), { timeout: 2500 })
    expect(mockFetchMapClusters.mock.calls[1]?.[2]).toEqual(expect.objectContaining({ radius: 25 }))
  })

  it('does not wait for a refit when the renderer never re-fits (native)', async () => {
    const wrapper = makeWrapper()
    const bbox = { south: 53.86, west: 27.52, north: 53.94, east: 27.6 }
    const { rerender } = await renderHook(
      ({ radius }) =>
        useMapClusters({
          bbox,
          zoom: 12,
          debounceMs: 0,
          awaitRadiusRefit: false,
          filters: { lat: 53.9, lng: 27.56, radius },
        }),
      { wrapper, initialProps: { radius: 50 } },
    )
    await waitFor(() => expect(mockFetchMapClusters).toHaveBeenCalledTimes(1))
    await rerender({ radius: 25 })
    // Well inside the 900 ms refit window.
    await waitFor(() => expect(mockFetchMapClusters).toHaveBeenCalledTimes(2), { timeout: 300 })
    expect(mockFetchMapClusters.mock.calls[1]?.[2]).toEqual(expect.objectContaining({ radius: 25 }))
  })
})
