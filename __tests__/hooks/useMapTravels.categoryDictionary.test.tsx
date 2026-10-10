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
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useMapTravels } from '@/hooks/map/useMapTravels'
import { resolveMapPointCategoryDictionary } from '@/hooks/map/useMapFilters'

const mockFetchTravelsForMap = jest.fn()
const mockFetchTravelsNearRoute = jest.fn()

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
  })
})
