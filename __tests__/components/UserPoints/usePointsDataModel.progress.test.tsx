import React from 'react'
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

jest.mock('@/api/userPoints', () => ({
  userPointsApi: { getPointsPage: jest.fn() },
}))

jest.mock('@/api/miscOptimized', () => ({
  fetchAllFiltersOptimized: jest.fn(async () => ({ categoryTravelAddress: [] })),
}))

const { userPointsApi } = require('@/api/userPoints')
const mockGetPointsPage = userPointsApi.getPointsPage as jest.Mock

import { usePointsDataModel } from '@/components/UserPoints/usePointsDataModel'

const PER_PAGE = 200
const TOTAL = 450

const makePoints = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: from + i, name: `P${from + i}`, latitude: 1, longitude: 2, color: 'blue', status: 'planning' }))

// #3133: «Загружено N из M» — знаменатель приходит серверным count первой страницы.
describe('usePointsDataModel load progress', () => {
  it('exposes loaded/total while streaming and marks completion at the end', async () => {
    mockGetPointsPage.mockImplementation(async (page: number, perPage: number) => {
      const from = (page - 1) * perPage + 1
      const count = Math.max(0, Math.min(perPage, TOTAL - (page - 1) * perPage))
      const items = makePoints(from, count)
      return { items, hasMore: items.length >= perPage, total: TOTAL }
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = await renderHook(
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

    await waitFor(() => {
      expect(result.current.points.length).toBeGreaterThanOrEqual(PER_PAGE)
    })
    // Пока стрим идёт — знаменатель уже известен из count первой страницы.
    await waitFor(() => {
      expect(result.current.loadProgress.total).toBe(TOTAL)
    })

    await waitFor(() => {
      expect(result.current.points.length).toBe(TOTAL)
    })
    await waitFor(() => {
      expect(result.current.loadProgress).toEqual({ loaded: TOTAL, total: TOTAL, complete: true })
    })
  })

  it('reports a complete collection without a denominator gap when one page holds everything', async () => {
    mockGetPointsPage.mockResolvedValue({ items: makePoints(1, 10), hasMore: false, total: 10 })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = await renderHook(
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
    await waitFor(() => {
      expect(result.current.loadProgress).toEqual({ loaded: 10, total: 10, complete: true })
    })
  })
})
