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
    categoryTravelAddress: [{ id: 7, name: 'Водопад' }],
  })),
}))

const { userPointsApi } = require('@/api/userPoints')
const mockGetAllPins = userPointsApi.getAllPins as jest.Mock

import { usePointsDataModel } from '@/components/UserPoints/usePointsDataModel'

const pins = [
  { id: 1, latitude: 54.9, longitude: 26.9, color: 'blue', status: 'planning', category: 'Озеро', category_ids: [] },
  { id: 2, latitude: 53.9, longitude: 27.5, color: 'red', status: 'planning', category: 'other', category_ids: [] },
  { id: 3, latitude: 53.8, longitude: 27.4, color: 'red', status: 'visited', category: 'other', category_ids: [7] },
  { id: 4, latitude: 53.7, longitude: 27.3, color: 'green', status: 'planning', category: 'Водопад', category_ids: [] },
]

// Сервер ищет по имени, адресу, заметкам и имени категории (#3129): клиент
// получает подмножество пинов и сужает коллекцию до их id.
const serverSearch = (query: string) => {
  if (query === 'озера') return [pins[0]]
  if (query === 'водопад') return [pins[2], pins[3]]
  return []
}

const renderModel = async (searchQuery: string, filters: Record<string, unknown> = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return await renderHook(
    (props: { searchQuery: string }) =>
      usePointsDataModel({
        filters: { page: 1, perPage: 200, radiusKm: 100, ...filters } as any,
        searchQuery: props.searchQuery,
        currentLocation: null,
        defaultPointColors: ['blue'],
      }),
    { wrapper, initialProps: { searchQuery } }
  )
}

describe('usePointsDataModel: серверный поиск по пинам (#3161)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAllPins.mockImplementation(async (filters?: { search?: string }) =>
      filters?.search ? serverSearch(filters.search) : pins,
    )
  })

  it('без запроса читает коллекцию одним запросом без search', async () => {
    const { result } = await renderModel('')
    await waitFor(() => expect(result.current.points).toHaveLength(pins.length))
    expect(mockGetAllPins).toHaveBeenCalledTimes(1)
    expect(mockGetAllPins).toHaveBeenCalledWith()
    expect(result.current.isSearching).toBe(false)
  })

  it.each([
    ['  Озёра ', [1]],
    ['водопад', [3, 4]],
    ['нет такого', []],
  ])('запрос %p уходит на сервер нормализованным и сужает коллекцию', async (query, expectedIds) => {
    const { result } = await renderModel(query)
    await waitFor(() => expect(result.current.isSearching).toBe(false))
    await waitFor(() => expect(result.current.points.length).toBeGreaterThanOrEqual(0))
    expect(mockGetAllPins).toHaveBeenCalledWith({ search: query.toLowerCase().replace(/ё/g, 'е').trim() })
    await waitFor(() => {
      expect(result.current.filteredPoints.map((p) => p.id).sort()).toEqual(expectedIds)
    })
    // Счётчик «Всего» — вся коллекция, не результат поиска.
    expect(result.current.totalCount).toBe(pins.length)
  })

  it('пока сервер отвечает на новый запрос, держит прежний результат и флаг isSearching', async () => {
    let release: (() => void) | null = null
    mockGetAllPins.mockImplementation(async (filters?: { search?: string }) => {
      if (!filters?.search) return pins
      if (filters.search === 'водопад') {
        await new Promise<void>((resolve) => {
          release = resolve
        })
      }
      return serverSearch(filters.search)
    })
    const { result, rerender } = await renderModel('озера')
    await waitFor(() => expect(result.current.filteredPoints.map((p) => p.id)).toEqual([1]))

    await rerender({ searchQuery: 'водопад' })
    await waitFor(() => expect(result.current.isSearching).toBe(true))
    expect(result.current.filteredPoints.map((p) => p.id)).toEqual([1])

    release?.()
    await waitFor(() => expect(result.current.filteredPoints.map((p) => p.id).sort()).toEqual([3, 4]))
    expect(result.current.isSearching).toBe(false)
  })

  it('упавший серверный поиск — ошибка с «Повторить», а не вся коллекция под запросом', async () => {
    mockGetAllPins.mockImplementation(async (filters?: { search?: string }) => {
      if (filters?.search) throw new Error('network')
      return pins
    })
    const { result } = await renderModel('озера')
    await waitFor(() => expect(result.current.loadFailed).toBe(true))
    expect(result.current.filteredPoints).toEqual([])
    expect(result.current.isSearching).toBe(false)

    mockGetAllPins.mockImplementation(async (filters?: { search?: string }) =>
      filters?.search ? serverSearch(filters.search) : pins,
    )
    await result.current.refetch()
    await waitFor(() => expect(result.current.filteredPoints.map((p) => p.id)).toEqual([1]))
    expect(result.current.loadFailed).toBe(false)
  })

  it('клиентские фильтры (цвет, статус, категория) применяются поверх результата поиска', async () => {
    const { result } = await renderModel('водопад', { statuses: ['visited'] })
    await waitFor(() => expect(result.current.filteredPoints.map((p) => p.id)).toEqual([3]))
  })
})
