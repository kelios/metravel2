import React from 'react'
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

jest.mock('@/api/userPoints', () => ({
  userPointsApi: {
    getAllPins: jest.fn(),
    getPointsByIds: jest.fn(async () => []),
  },
}))

jest.mock('@/api/miscOptimized', () => ({
  fetchAllFiltersOptimized: jest.fn(async () => ({
    categoryTravelAddress: [
      { id: 7, name: 'Водопад' },
      { id: 12, name: 'Парковка' },
    ],
  })),
}))

const { userPointsApi } = require('@/api/userPoints')
const mockGetAllPins = userPointsApi.getAllPins as jest.Mock

import { usePointsDataModel } from '@/components/UserPoints/usePointsDataModel'

// Пины как у `fields=pins` (#3129/#3172): без имён и адресов, с category_ids.
const pins = [
  { id: 1, latitude: 54.9, longitude: 26.9, color: 'blue', status: 'planning', category: 'Озеро', category_ids: [] },
  { id: 2, latitude: 53.9, longitude: 27.5, color: 'red', status: 'visited', category: 'other', category_ids: [7] },
  { id: 3, latitude: 53.8, longitude: 27.4, color: 'red', status: 'planning', category: 'Парковка', category_ids: [] },
  // Бэкенд до #3172: пин без category_ids — категория сайта по имени через словарь.
  { id: 4, latitude: 53.7, longitude: 27.3, color: 'green', status: 'planning', category: 'Водопад' },
  { id: 5, latitude: 10, longitude: 10, color: 'green', status: 'planning', category: 'other', category_ids: [] },
]

const renderModel = async (filters: Record<string, unknown>, currentLocation: { lat: number; lng: number } | null = null) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return await renderHook(
    () =>
      usePointsDataModel({
        filters: { page: 1, perPage: 200, ...filters } as any,
        searchQuery: '',
        currentLocation,
        defaultPointColors: ['blue', 'yellow'],
      }),
    { wrapper }
  )
}

describe('usePointsDataModel на пинах (#3161)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAllPins.mockResolvedValue(pins)
  })

  it('читает коллекцию одним запросом пинов и отдаёт totalCount', async () => {
    const { result } = await renderModel({})
    await waitFor(() => expect(result.current.points).toHaveLength(pins.length))
    expect(mockGetAllPins).toHaveBeenCalledTimes(1)
    expect(result.current.totalCount).toBe(pins.length)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.loadFailed).toBe(false)
  })

  it('категории сайта: по category_ids, а без них — по имени через словарь; фасеты по пинам', async () => {
    const { result } = await renderModel({ categoryIds: ['7'] })
    await waitFor(() => expect(result.current.filteredPoints.map((p) => p.id).sort()).toEqual([2, 4]))
    expect(result.current.availableCategoryOptions).toEqual([
      { id: '7', name: 'Водопад' },
      { id: '12', name: 'Парковка' },
    ])
  })

  it('цвет, статус и радиус фильтруются на клиенте', async () => {
    const byColor = await renderModel({ colors: ['red'] })
    await waitFor(() => expect(byColor.result.current.filteredPoints.map((p) => p.id).sort()).toEqual([2, 3]))

    const byStatus = await renderModel({ statuses: ['visited'] })
    await waitFor(() => expect(byStatus.result.current.filteredPoints.map((p) => p.id)).toEqual([2]))

    const byRadius = await renderModel({ radiusKm: 100 }, { lat: 53.9, lng: 27.5 })
    await waitFor(() => expect(byRadius.result.current.filteredPoints.map((p) => p.id).sort()).toEqual([2, 3, 4]))
    expect(byRadius.result.current.availableColors).toEqual(['red', 'green', 'blue', 'yellow'])
  })

  it('ошибка чтения пинов → loadFailed, а не «у вас нет точек»', async () => {
    mockGetAllPins.mockRejectedValue(new Error('offline'))
    const { result } = await renderModel({})
    await waitFor(() => expect(result.current.loadFailed).toBe(true))
    expect(result.current.points).toEqual([])
  })
})
