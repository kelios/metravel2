/**
 * Регрессия: в режиме маршрута с карты пропадали ВСЕ маркеры мест и счётчик
 * «Показать список рядом» — добавлять в маршрут было визуально нечего.
 *
 * Корень: запрос активировался только при `mode === 'route' && fullRouteCoords >= 2`,
 * то есть пока маршрут собирается (0–1 точки) датасет был пуст. Пока маршрут не
 * построен, источник данных = радиус-запрос вокруг якоря; как только точек >= 2 —
 * корридорный запрос вдоль маршрута.
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

const COORDINATES = { latitude: 53.9, longitude: 27.56 }
const FILTERS = { categories: [], categoryTravelAddress: [], radius: [], address: '' } as any
const FILTER_VALUES = {
  categories: [],
  categoryTravelAddress: [],
  radius: '50',
  address: '',
  searchQuery: '',
} as any

const RADIUS_POINTS = [
  { id: 1, coord: '53.9,27.5', address: 'Radius point', categoryName: 'Замки' },
]
const ROUTE_POINTS = [
  { id: 2, coord: '53.5,27.1', address: 'Corridor point', categoryName: 'Замки' },
]

const makeWrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

const renderTravels = (mode: 'radius' | 'route', fullRouteCoords: [number, number][]) =>
  renderHook(
    () =>
      useMapTravels({
        coordinates: COORDINATES,
        filterValues: FILTER_VALUES,
        filters: FILTERS,
        mode,
        fullRouteCoords,
        isFocused: true,
      }),
    { wrapper: makeWrapper() },
  )

describe('useMapTravels — data source while a route is being built', () => {
  beforeEach(() => {
    mockFetchTravelsForMap.mockReset()
    mockFetchTravelsNearRoute.mockReset()
    mockFetchTravelsForMap.mockResolvedValue(RADIUS_POINTS)
    mockFetchTravelsNearRoute.mockResolvedValue(ROUTE_POINTS)
  })

  it('keeps places visible in route mode with no route points yet', async () => {
    const { result } = renderTravels('route', [])

    await waitFor(() => expect(result.current.allTravelsData).toHaveLength(1))
    expect(result.current.total).toBe(1)
    expect(mockFetchTravelsForMap).toHaveBeenCalled()
    expect(mockFetchTravelsNearRoute).not.toHaveBeenCalled()
  })

  it('keeps places visible in route mode with a single start point', async () => {
    const { result } = renderTravels('route', [[27.56, 53.9]])

    await waitFor(() => expect(result.current.allTravelsData).toHaveLength(1))
    expect(result.current.total).toBe(1)
    expect(mockFetchTravelsNearRoute).not.toHaveBeenCalled()
  })

  it('switches to the route corridor query once the route is built', async () => {
    const { result } = renderTravels('route', [
      [27.56, 53.9],
      [27.1, 53.5],
    ])

    await waitFor(() => expect(result.current.allTravelsData).toHaveLength(1))
    expect(result.current.allTravelsData[0]).toMatchObject({ address: 'Corridor point' })
    expect(mockFetchTravelsNearRoute).toHaveBeenCalled()
  })

  it('still uses the radius query in plain radius mode', async () => {
    const { result } = renderTravels('radius', [])

    await waitFor(() => expect(result.current.allTravelsData).toHaveLength(1))
    expect(result.current.allTravelsData[0]).toMatchObject({ address: 'Radius point' })
    expect(mockFetchTravelsNearRoute).not.toHaveBeenCalled()
  })
})
