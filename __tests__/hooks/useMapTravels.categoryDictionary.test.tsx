/**
 * #2374 (MAP-FILTER-DICTIONARY-KEY-001): чип «Замок» на /map фильтровал только
 * первую страницу (30 точек) на клиенте. Корень — словарь типов мест читался из
 * ключа `categoryTravelAddress`, которого нет в живом `/api/filterformap/` (там
 * `categories`), поэтому имя чипа не превращалось в ID и сервер фильтра не получал.
 *
 * Контракт: словарь из ответа `{ categories }` → имя чипа → ID уходит серверу в
 * `where.categoryTravelAddress`, а список и счётчик — вся серверная выдача радиуса.
 */
import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useMapTravels } from '@/hooks/map/useMapTravels'
import { resolveMapPointCategoryDictionary } from '@/hooks/map/useMapFilters'
import type { FiltersData } from '@/hooks/map/useMapFilters'

const mockFetchTravelsForMap = jest.fn()
const mockFetchTravelsNearRoute = jest.fn()
const mockReadAllMapPointsOffline = jest.fn()
let mockIsConnected = true

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isConnected: mockIsConnected }),
}))
jest.mock('@/services/offline/mapOfflineAdapter', () => ({
  readAllMapPointsOffline: () => mockReadAllMapPointsOffline(),
}))
jest.mock('@/services/offline/offlineCatalog', () => ({
  offlineCatalog: { subscribe: () => () => {} },
}))

jest.mock('@/api/map', () => ({
  __esModule: true,
  fetchTravelsForMap: (...args: any[]) => mockFetchTravelsForMap(...args),
  fetchTravelsNearRoute: (...args: any[]) => mockFetchTravelsNearRoute(...args),
  fetchFiltersMap: jest.fn(),
}))

const KRAKOW = { latitude: 50.0647, longitude: 19.945 }

// Форма живого ответа `GET /api/filterformap/` (11.10.2026): 189 категорий, ключ `categories`.
const FILTER_FOR_MAP_RESPONSE = {
  categories: [
    { id: '205', name: 'автобус' },
    { id: '43', name: 'Замок' },
    { id: '115', name: 'Руины замка' },
  ],
  radius: [{ id: '60', name: '60' }],
}

// Сервер уже отфильтровал по ID: вторая точка с другим/составным именем категории
// не должна выпасть из выдачи клиентским name-фильтром.
const serverPage = (() => {
  const out: Record<string, unknown> = {
    0: { id: 1, coord: '50.06,19.93', address: 'Wawel', categoryName: 'Замок' },
    1: { id: 2, coord: '50.10,19.80', address: 'Tenczyn', categoryName: 'Руины замка, Замок' },
  }
  Object.defineProperty(out, '__total', { value: 10, enumerable: false })
  return out
})()

const makeWrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe('useMapTravels — point-type chip resolves through the /api/filterformap/ dictionary', () => {
  beforeEach(() => {
    mockFetchTravelsForMap.mockReset()
    mockFetchTravelsNearRoute.mockReset()
    mockIsConnected = true
    mockReadAllMapPointsOffline.mockReset()
    mockReadAllMapPointsOffline.mockResolvedValue([])
    mockFetchTravelsForMap.mockResolvedValue(serverPage)
  })

  it('sends the chip ID to the server and reports the server total, not a client-filtered page', async () => {
    const filters = {
      categories: [],
      categoryTravelAddress: resolveMapPointCategoryDictionary(FILTER_FOR_MAP_RESPONSE as any),
      radius: [],
      address: '',
    }
    const filterValues = {
      categories: [],
      categoryTravelAddress: ['Замок'],
      radius: '50',
      address: '',
      searchQuery: '',
    } as any

    const { result } = renderHook(
      () =>
        useMapTravels({
          coordinates: KRAKOW,
          filterValues,
          filters,
          mode: 'radius',
          fullRouteCoords: [],
          isFocused: true,
        }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.total).toBe(10))
    expect(mockFetchTravelsForMap).toHaveBeenCalledWith(
      0,
      expect.any(Number),
      expect.objectContaining({ categoryTravelAddress: [43] }),
      expect.anything(),
    )
    expect(result.current.filteredTravelsData).toHaveLength(2)
    expect(result.current.totalScope).toBe('radius')
  })
  it('falls back to the client-filtered length when the chip name is missing from the dictionary', async () => {
    const filters = { categories: [], categoryTravelAddress: [], radius: [], address: '' }
    const filterValues = {
      categories: [],
      categoryTravelAddress: ['Руины замка'],
      radius: '50',
      address: '',
      searchQuery: '',
    } as any

    const { result } = renderHook(
      () =>
        useMapTravels({
          coordinates: KRAKOW,
          filterValues,
          filters,
          mode: 'radius',
          fullRouteCoords: [],
          isFocused: true,
        }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.filteredTravelsData).toHaveLength(1))
    expect(mockFetchTravelsForMap).toHaveBeenCalledWith(
      0,
      expect.any(Number),
      expect.not.objectContaining({ categoryTravelAddress: expect.anything() }),
      expect.anything(),
    )
    expect(result.current.total).toBe(1)
    expect(result.current.totalScope).toBe('loaded')
  })

  // `travels/near-route` категорий не принимает: резолвленный ID в режиме
  // построенного маршрута не должен отключать клиентский фильтр чипа.
  it('keeps the client chip filter in route mode, where the corridor endpoint ignores categories', async () => {
    mockFetchTravelsNearRoute.mockResolvedValue([
      { id: 3, coord: '50.06,19.93', address: 'Wawel', categoryName: 'Замок' },
      { id: 4, coord: '50.07,19.94', address: 'Rynek', categoryName: 'Площадь' },
    ])
    const filters = {
      categories: [],
      categoryTravelAddress: resolveMapPointCategoryDictionary(FILTER_FOR_MAP_RESPONSE as any),
      radius: [],
      address: '',
    }
    const filterValues = {
      categories: [],
      categoryTravelAddress: ['Замок'],
      radius: '50',
      address: '',
      searchQuery: '',
    } as any

    const { result } = renderHook(
      () =>
        useMapTravels({
          coordinates: KRAKOW,
          filterValues,
          filters,
          mode: 'route',
          fullRouteCoords: [[19.93, 50.06], [19.94, 50.07]],
          isFocused: true,
        }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.allTravelsData).toHaveLength(2))
    expect(result.current.filteredTravelsData.map((t) => t.id)).toEqual([3])
    expect(result.current.total).toBe(1)
    expect(result.current.totalScope).toBe('loaded')
  })

  const baseParams: Parameters<typeof useMapTravels>[0] = {
    coordinates: KRAKOW,
    filters: {
      categories: [],
      categoryTravelAddress: [{ id: '43', name: 'Замок' }],
      categoryDictionaryState: 'ready' as const,
      radius: [],
      address: '',
    },
    filterValues: { categories: [], categoryTravelAddress: ['43'], radius: '50', address: '', searchQuery: '' },
    mode: 'radius' as const,
    fullRouteCoords: [] as [number, number][],
    isFocused: true,
  }

  const page = (items: { id: number; categoryName: string }[], total: number) => {
    const result = Object.fromEntries(items.map((point, index) => [index, { ...point, coord: '50.06,19.93' }]))
    Object.defineProperty(result, '__total', { value: total, enumerable: false })
    return result
  }

  it('accepts a numeric URL category ID and keeps the whole server-filtered point page', async () => {
    const { result } = renderHook(() => useMapTravels(baseParams), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.total).toBe(10))
    expect(mockFetchTravelsForMap.mock.calls[0][2].categoryTravelAddress).toEqual([43])
    expect(result.current.filteredTravelsData.map(({ id }) => id)).toEqual([1, 2])
    expect(result.current.totalScope).toBe('radius')
  })

  it('keeps mixed OR members when loading further unnarrowed radius pages', async () => {
    mockFetchTravelsForMap.mockImplementation((pageIndex: number) => Promise.resolve(pageIndex === 0
      ? page([{ id: 1, categoryName: 'Замок' }, { id: 2, categoryName: 'Unknown' }], 4)
      : page([{ id: 3, categoryName: 'Площадь' }, { id: 4, categoryName: 'Unknown' }], 4)))
    const { result } = renderHook(() => useMapTravels({
      ...baseParams,
      filterValues: { ...baseParams.filterValues, categoryTravelAddress: ['43', 'Unknown'] },
    }), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.filteredTravelsData.map(({ id }) => id)).toEqual([1, 2]))
    expect(result.current.total).toBe(2)
    expect(result.current.totalScope).toBe('loaded')
    act(() => result.current.loadMore())
    await waitFor(() => expect(result.current.allTravelsData).toHaveLength(4))
    expect(result.current.filteredTravelsData.map(({ id }) => id)).toEqual([1, 2, 4])
    expect(result.current.total).toBe(3)
    expect(result.current.hasMore).toBe(false)
    expect(mockFetchTravelsForMap.mock.calls.map(([pageIndex, , where]) => [pageIndex, where.categoryTravelAddress]))
      .toEqual([[0, undefined], [1, undefined]])
  })

  it.each(['loading', 'error'] as const)('does not narrow by a partial dictionary while it is %s', async (state) => {
    mockFetchTravelsForMap.mockResolvedValue(page([
      { id: 1, categoryName: 'Замок' }, { id: 2, categoryName: 'Unknown' }, { id: 3, categoryName: 'Площадь' },
    ], 10))
    const { result } = renderHook(() => useMapTravels({
      ...baseParams,
      filters: { ...baseParams.filters, categoryDictionaryState: state },
      filterValues: { ...baseParams.filterValues, categoryTravelAddress: ['43', 'Unknown'] },
    }), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.allTravelsData).toHaveLength(3))
    expect(result.current.filteredTravelsData.map(({ id }) => id)).toEqual([1, 2])
    expect(mockFetchTravelsForMap.mock.calls[0][2].categoryTravelAddress).toBeUndefined()
    expect(result.current.total).toBe(2)
    expect(result.current.totalScope).toBe('loaded')
  })

  it('resolves a retained numeric token when the dictionary becomes ready', async () => {
    const { result, rerender } = renderHook(
      (filters: FiltersData) => useMapTravels({ ...baseParams, filters }),
      { wrapper: makeWrapper(), initialProps: { ...baseParams.filters, categoryTravelAddress: [], categoryDictionaryState: 'loading' as 'loading' | 'ready' } },
    )
    await waitFor(() => expect(result.current.allTravelsData).toHaveLength(2))
    expect(mockFetchTravelsForMap.mock.calls[0][2].categoryTravelAddress).toBeUndefined()
    expect(result.current.filteredTravelsData).toHaveLength(0)
    rerender(baseParams.filters)
    await waitFor(() => expect(result.current.totalScope).toBe('radius'))
    expect(mockFetchTravelsForMap.mock.calls.at(-1)?.[2].categoryTravelAddress).toEqual([43])
    expect(result.current.filteredTravelsData).toHaveLength(2)
  })

  it('matches numeric and unknown categories with the same complete OR in a built route', async () => {
    mockFetchTravelsNearRoute.mockResolvedValue([
      { id: 1, coord: '50.06,19.93', categoryName: 'Замок' },
      { id: 2, coord: '50.07,19.94', categoryName: 'Unknown' },
      { id: 3, coord: '50.08,19.95', categoryName: 'Площадь' },
    ])
    const { result } = renderHook(() => useMapTravels({
      ...baseParams,
      mode: 'route',
      fullRouteCoords: [[19.93, 50.06], [19.94, 50.07]],
      filterValues: { ...baseParams.filterValues, categoryTravelAddress: ['43', 'Unknown'] },
    }), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.allTravelsData).toHaveLength(3))
    expect(result.current.filteredTravelsData.map(({ id }) => id)).toEqual([1, 2])
    expect(result.current.total).toBe(2)
    expect(result.current.totalScope).toBe('loaded')
    expect(mockFetchTravelsForMap).not.toHaveBeenCalled()
  })

  it('applies complete category OR and text search to the offline loaded index', async () => {
    mockIsConnected = false
    mockReadAllMapPointsOffline.mockResolvedValue([
      { id: 1, categoryName: 'Замок', address: 'Old castle' },
      { id: 2, categoryName: 'Unknown', address: 'Old ruin' },
      { id: 3, categoryName: 'Unknown', address: 'New museum' },
      { id: 4, categoryName: 'Площадь', address: 'Old square' },
    ])
    const { result } = renderHook(() => useMapTravels({
      ...baseParams,
      filterValues: { ...baseParams.filterValues, categoryTravelAddress: ['43', 'Unknown'], searchQuery: 'Old' },
    }), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.allTravelsData).toHaveLength(4))
    expect(result.current.filteredTravelsData.map(({ id }) => id)).toEqual([1, 2])
    expect(result.current.total).toBe(2)
    expect(result.current.totalScope).toBe('loaded')
    expect(result.current.hasMore).toBe(false)
  })

  it('does not silently cut a 51-category OR down to the server limit of 50', async () => {
    const categoryTravelAddress = Array.from({ length: 51 }, (_, index) => ({ id: String(index + 1), name: `Category ${index + 1}` }))
    mockFetchTravelsForMap.mockResolvedValue(page([
      { id: 1, categoryName: 'Category 1' }, { id: 51, categoryName: 'Category 51' }, { id: 99, categoryName: 'Other' },
    ], 100))
    const { result } = renderHook(() => useMapTravels({
      ...baseParams,
      filters: { ...baseParams.filters, categoryTravelAddress },
      filterValues: { ...baseParams.filterValues, categoryTravelAddress: categoryTravelAddress.map(({ id }) => String(id)) },
    }), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.allTravelsData).toHaveLength(3))
    expect(mockFetchTravelsForMap.mock.calls[0][2].categoryTravelAddress).toBeUndefined()
    expect(result.current.filteredTravelsData.map(({ id }) => id)).toEqual([1, 51])
    expect(result.current.total).toBe(2)
    expect(result.current.totalScope).toBe('loaded')
  })
})
