import React from 'react'
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

jest.mock('@/api/userPoints', () => {
  const getPoints = jest.fn()
  return {
    userPointsApi: {
      getPoints,
      // Mirror the real implementation: delegate to getPoints and derive hasMore.
      getPointsPage: jest.fn(async (page: number, perPage: number) => {
        const items = await getPoints({ page, perPage })
        return { items, hasMore: items.length >= perPage }
      }),
    },
  }
})

jest.mock('@/api/miscOptimized', () => ({
  fetchAllFiltersOptimized: jest.fn(async () => ({ categoryTravelAddress: [] })),
}))

const { userPointsApi } = require('@/api/userPoints')
const mockGetPoints = userPointsApi.getPoints as jest.Mock

import { usePointsDataModel } from '@/components/UserPoints/usePointsDataModel'

const PER_PAGE = 200

const makePoints = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: from + i,
    name: `P${from + i}`,
    latitude: 1,
    longitude: 2,
    color: 'blue',
    status: 'planning',
  }))

const renderModel = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return renderHook(
    () =>
      usePointsDataModel({
        defaultPerPage: PER_PAGE,
        filters: { page: 1, perPage: PER_PAGE, radiusKm: 100 } as any,
        searchQuery: '',
        currentLocation: null,
        defaultPointColors: ['blue'],
      }),
    { wrapper }
  )
}

describe('usePointsDataModel incremental streaming', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('requests the first page with perPage=200', async () => {
    mockGetPoints.mockResolvedValue(makePoints(1, 10))

    renderModel()

    await waitFor(() => {
      expect(mockGetPoints).toHaveBeenCalledWith({ page: 1, perPage: PER_PAGE })
    })
  })

  it('does not fetch a second page when the first page is short', async () => {
    mockGetPoints.mockResolvedValue(makePoints(1, 42))

    const { result } = renderModel()

    await waitFor(() => {
      expect(result.current.points).toHaveLength(42)
    })

    // Give any background effect a chance to run.
    await new Promise((r) => setTimeout(r, 20))

    expect(mockGetPoints).toHaveBeenCalledTimes(1)
    expect(mockGetPoints).not.toHaveBeenCalledWith({ page: 2, perPage: PER_PAGE })
  })

  it('streams subsequent full pages and accumulates them into points', async () => {
    mockGetPoints.mockImplementation(async ({ page }: { page: number }) => {
      if (page === 1) return makePoints(1, PER_PAGE)
      if (page === 2) return makePoints(1 + PER_PAGE, PER_PAGE)
      if (page === 3) return makePoints(1 + 2 * PER_PAGE, 30) // short -> last page
      return []
    })

    const { result } = renderModel()

    // First render: only page 1.
    await waitFor(() => {
      expect(result.current.points.length).toBeGreaterThanOrEqual(PER_PAGE)
    })

    // Background streaming brings in pages 2 and 3.
    await waitFor(() => {
      expect(result.current.points).toHaveLength(PER_PAGE * 2 + 30)
    })

    expect(mockGetPoints).toHaveBeenCalledWith({ page: 2, perPage: PER_PAGE })
    expect(mockGetPoints).toHaveBeenCalledWith({ page: 3, perPage: PER_PAGE })
  })

  it('does not stream at all when the backend ignores perPage (#752)', async () => {
    // Backend returns the whole oversized set for page 1.
    mockGetPoints.mockResolvedValue(makePoints(1, PER_PAGE * 2))

    const { result } = renderModel()

    await waitFor(() => {
      expect(result.current.points).toHaveLength(PER_PAGE * 2)
    })

    await new Promise((r) => setTimeout(r, 20))

    // Oversized first page = full set already loaded -> no background pages.
    expect(mockGetPoints).toHaveBeenCalledTimes(1)
    expect(mockGetPoints).not.toHaveBeenCalledWith({ page: 2, perPage: PER_PAGE })
  })

  it('stops streaming when a page adds zero new ids', async () => {
    // Page 1 looks properly paginated, but page 2 repeats the same items.
    mockGetPoints.mockImplementation(async ({ page }: { page: number }) => {
      if (page === 1) return makePoints(1, PER_PAGE)
      return makePoints(1, PER_PAGE)
    })

    const { result } = renderModel()

    await waitFor(() => {
      expect(result.current.points).toHaveLength(PER_PAGE)
    })

    await new Promise((r) => setTimeout(r, 20))

    // Page 2 adds zero new ids -> streaming must stop, no page 3.
    expect(mockGetPoints).toHaveBeenCalledTimes(2)
    expect(mockGetPoints).not.toHaveBeenCalledWith({ page: 3, perPage: PER_PAGE })
  })
})
