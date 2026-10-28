/**
 * #2450 — leaving the map tab must only PAUSE the radius query, not empty the
 * result set: before this, `isFocused=false` returned `[]` and `total=0`, which tore
 * down every marker and list row, and coming back rebuilt the whole screen.
 */
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useMapTravels } from '@/hooks/map/useMapTravels'

const mockFetchTravelsForMap = jest.fn()
const mockFetchTravelsNearRoute = jest.fn()

jest.mock('@/api/map', () => ({
  __esModule: true,
  fetchTravelsForMap: (...args: any[]) => mockFetchTravelsForMap(...args),
  fetchTravelsNearRoute: (...args: any[]) => mockFetchTravelsNearRoute(...args),
}))

const FILTERS = { categories: [], categoryTravelAddress: [], radius: [], address: '' } as any
const FILTER_VALUES = {
  categories: [],
  categoryTravelAddress: [],
  radius: '50',
  address: '',
  searchQuery: '',
} as any

const POINTS = [
  { id: 1, coord: '53.9,27.5', address: 'A', categoryName: 'Замки' },
  { id: 2, coord: '53.91,27.51', address: 'B', categoryName: 'Замки' },
]

const makeWrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe('useMapTravels — blur keeps the loaded result set', () => {
  beforeEach(() => {
    mockFetchTravelsForMap.mockReset()
    mockFetchTravelsNearRoute.mockReset()
    const page = Object.assign([...POINTS], { __total: 2 })
    mockFetchTravelsForMap.mockResolvedValue(page)
  })

  it('keeps data and total when the screen loses focus and does not refetch on return', async () => {
    const { result, rerender } = await renderHook(
      ({ isFocused, coordinates }) =>
        useMapTravels({
          coordinates,
          filterValues: FILTER_VALUES,
          filters: FILTERS,
          mode: 'radius',
          fullRouteCoords: [],
          isFocused,
        }),
      {
        wrapper: makeWrapper(),
        initialProps: { isFocused: true, coordinates: { latitude: 53.9, longitude: 27.56 } },
      },
    )

    await waitFor(() => expect(result.current.allTravelsData).toHaveLength(2))
    expect(result.current.total).toBe(2)
    expect(mockFetchTravelsForMap).toHaveBeenCalledTimes(1)

    await rerender({ isFocused: false, coordinates: { latitude: 53.9, longitude: 27.56 } })
    expect(result.current.allTravelsData).toHaveLength(2)
    expect(result.current.total).toBe(2)

    // GPS jitter below ~11 m on re-focus does not change the query key.
    await rerender({ isFocused: true, coordinates: { latitude: 53.900004, longitude: 27.560003 } })
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(mockFetchTravelsForMap).toHaveBeenCalledTimes(1)
    expect(result.current.allTravelsData).toHaveLength(2)
  })

  it('keeps loadMore referentially stable across fetch lifecycle ticks', async () => {
    const { result } = await renderHook(
      () =>
        useMapTravels({
          coordinates: { latitude: 53.9, longitude: 27.56 },
          filterValues: FILTER_VALUES,
          filters: FILTERS,
          mode: 'radius',
          fullRouteCoords: [],
          isFocused: true,
        }),
      { wrapper: makeWrapper() },
    )
    const first = result.current.loadMore
    await waitFor(() => expect(result.current.allTravelsData).toHaveLength(2))
    expect(result.current.loadMore).toBe(first)
  })
})
