import React from 'react'
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

jest.mock('@/api/userPoints', () => {
  const getPoints = jest.fn()
  return {
    userPointsApi: {
      getPoints,
      getPointsPage: jest.fn(async (page: number, perPage: number) => {
        const items = await getPoints({ page, perPage })
        return { items, hasMore: items.length >= perPage }
      }),
    },
  }
})

jest.mock('@/api/miscOptimized', () => ({
  fetchAllFiltersOptimized: jest.fn(async () => ({
    categoryTravelAddress: [{ id: 7, name: 'Водопад' }],
  })),
}))

const { userPointsApi } = require('@/api/userPoints')
const mockGetPoints = userPointsApi.getPoints as jest.Mock

import { usePointsDataModel } from '@/components/UserPoints/usePointsDataModel'

const PER_PAGE = 200

const points = [
  { id: 1, name: 'Голубые озёра', address: 'Мядельский район', latitude: 54.9, longitude: 26.9, color: 'blue', status: 'planning' },
  { id: 2, name: 'Безымянная точка', address: 'Лес', description: 'Старая водяная мельница', latitude: 53.9, longitude: 27.5, color: 'red', status: 'planning' },
  { id: 3, name: 'Точка 3', address: 'Поле', notes: 'заехать за ЁЛКОЙ', latitude: 53.8, longitude: 27.4, color: 'red', status: 'planning' },
  { id: 4, name: 'Точка 4', address: 'Овраг', categoryIds: ['7'], latitude: 53.7, longitude: 27.3, color: 'green', status: 'planning' },
  { id: 5, name: 'Курган', address: 'Холм', categoryIds: ['99'], latitude: 53.6, longitude: 27.2, color: 'green', status: 'planning' },
  // Как на проде: категория — имя строкой, которого нет в словаре.
  { id: 6, name: 'Стоянка', address: 'Трасса', category: 'Парковка', categories: [], latitude: 53.5, longitude: 27.1, color: 'green', status: 'planning' },
]

const renderModel = async (searchQuery: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return await renderHook(
    (props: { searchQuery: string }) =>
      usePointsDataModel({
        defaultPerPage: PER_PAGE,
        filters: { page: 1, perPage: PER_PAGE, radiusKm: 100 } as any,
        searchQuery: props.searchQuery,
        currentLocation: null,
        defaultPointColors: ['blue'],
      }),
    { wrapper, initialProps: { searchQuery } }
  )
}

// #3132: поиск по индексу — название, адрес, описание, заметки, категория; ё/регистр.
describe('usePointsDataModel search index', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetPoints.mockResolvedValue(points)
  })

  it.each([
    ['озера', [1]],
    ['мельниц', [2]],
    ['елкой', [3]],
    ['водопад', [4]],
    ['  ТОЧКА  ', [2, 3, 4]],
    // Категория без имени в словаре не попадает в индекс голым id.
    ['99', []],
    ['парковка', [6]],
  ])('finds points for %p', async (query, expectedIds) => {
    const { result } = await renderModel(query)
    await waitFor(() => {
      expect(result.current.points.length).toBe(points.length)
    })
    await waitFor(() => {
      expect(result.current.filteredPoints.map((p: any) => p.id).sort()).toEqual(expectedIds)
    })
  })

  it('keeps the precomputed index on the point and does not rebuild it per query', async () => {
    const { result, rerender } = await renderModel('')
    await waitFor(() => {
      expect(result.current.filteredPoints.length).toBe(points.length)
    })
    const indexed = result.current.filteredPoints[1] as any
    expect(indexed.searchText).toContain('старая водяная мельница')

    await rerender({ searchQuery: 'мельниц' })
    await waitFor(() => {
      expect(result.current.filteredPoints.map((p: any) => p.id)).toEqual([2])
    })
    // Тот же объект точки: индекс не пересчитывался на ввод.
    expect(result.current.filteredPoints[0]).toBe(indexed)
  })
})
