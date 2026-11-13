/**
 * #2911: блок «Рядом с маршрутом» в планировщике — карточки из `/ai/near-route`, кнопка
 * «Добавить в маршрут», скрытие уже добавленных источников, пусто/ошибка/без координат → null.
 */
import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { AiPickItem } from '@/api/aiPicks'
import type { RoutePoint } from '@/api/plannedTripsTypes'
import RouteNearSuggestions, { routeGeoPoints } from '@/components/trips/planning/RouteNearSuggestions'

const mockFetch = jest.fn()
jest.mock('@/api/aiPicks', () => ({
  ...jest.requireActual('@/api/aiPicks'),
  fetchNearRoute: (...args: unknown[]) => mockFetch(...args),
}))
jest.mock('@/utils/aiPicksConfig', () => ({ ...jest.requireActual('@/utils/aiPicksConfig'), isAiPicksEnabled: () => true }))
// Пауза 800 мс проверена в `__tests__/hooks/useAiNearRoute.test.tsx`; здесь точки применяются сразу.
jest.mock('@/hooks/useDebouncedValue', () => ({ ...jest.requireActual('@/hooks/useDebouncedValue'), useDebouncedValue: (value: unknown) => value }))
jest.mock('@/hooks/useResponsive', () => {
  const actual = jest.requireActual('@/hooks/useResponsive')
  return { ...actual, useResponsive: () => ({ ...actual.useResponsive(), isHydrated: true, isMobile: false }) }
})
jest.mock('@/components/ui/UnifiedTravelCard', () => ({
  __esModule: true,
  default: (props: any) => {
    const ReactLib = require('react')
    const { View, Text } = require('react-native')
    return ReactLib.createElement(View, { testID: 'unified-card' }, ReactLib.createElement(Text, null, props.title))
  },
}))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))

const item = (type: AiPickItem['type'], id: number, title: string, coords: [number, number] | null = [53.68, 23.83]): AiPickItem => ({
  type,
  source_id: id,
  title,
  url: `https://metravel.by/${type}s/${id}`,
  path: `/${type}s/${id}`,
  snippet: `о ${title}`,
  score: null,
  city: 'Гродно',
  country: 'Беларусь',
  lat: coords ? coords[0] : null,
  lng: coords ? coords[1] : null,
  cover: null,
})

const point = (name: string, coordinates: [number, number] | null, placeId: number | null = null): RoutePoint => ({
  id: name,
  type: placeId == null ? 'custom' : 'place',
  name,
  description: null,
  coordinates,
  placeId,
})

const renderBlock = async (route: RoutePoint[], onAddPoint = jest.fn()) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const screen = await render(
    <QueryClientProvider client={client}>
      <React.Suspense fallback={null}><RouteNearSuggestions route={route} onAddPoint={onAddPoint} /></React.Suspense>
    </QueryClientProvider>,
  )
  return { screen, onAddPoint }
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe('RouteNearSuggestions (#2911)', () => {
  it('координаты маршрута [lng, lat] → {lat, lng}; точки без координат пропущены', () => {
    expect(routeGeoPoints([point('a', [27.56, 53.9]), point('b', null), point('c', [NaN, 1])])).toEqual([{ lat: 53.9, lng: 27.56 }])
  })

  it('карточки по маршруту; «Добавить в маршрут» отдаёт карточку и скрывает её; статья, уже стоящая точкой, скрыта', async () => {
    mockFetch.mockResolvedValue([item('quest', 1, 'Квест по Гродно'), item('travel', 11, 'Лида'), item('travel', 77, 'Уже в маршруте'), item('travel', 12, 'Без координат', null)])
    const { screen, onAddPoint } = await renderBlock([point('Минск', [27.56, 53.9]), point('Статья', [26.0, 53.5], 77)])
    await waitFor(() => expect(screen.getByTestId('route-near-suggestions-rail')).toBeTruthy())
    expect(mockFetch.mock.calls[0][0]).toMatchObject({ points: [{ lat: 53.9, lng: 27.56 }, { lat: 53.5, lng: 26.0 }] })
    expect(screen.getByTestId('route-near-add-quest-1')).toBeTruthy()
    expect(screen.getByTestId('route-near-add-travel-11')).toBeTruthy()
    expect(screen.queryByTestId('route-near-add-travel-77')).toBeNull()
    expect(screen.queryByTestId('route-near-add-travel-12')).toBeNull()

    await fireEvent.press(screen.getByTestId('route-near-add-quest-1'))
    expect(onAddPoint).toHaveBeenCalledWith(expect.objectContaining({ type: 'quest', source_id: 1, lat: 53.68, lng: 23.83 }))
    await waitFor(() => expect(screen.queryByTestId('route-near-add-quest-1')).toBeNull())
    expect(screen.getByTestId('route-near-add-travel-11')).toBeTruthy()
  })

  it('пустой ответ, отказ службы и маршрут без координат — блока нет', async () => {
    mockFetch.mockResolvedValue([])
    const empty = await renderBlock([point('Минск', [27.56, 53.9])])
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(empty.screen.queryByTestId('route-near-suggestions')).toBeNull())

    mockFetch.mockRejectedValue(new Error('503'))
    const failed = await renderBlock([point('Гродно', [23.83, 53.68])])
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(failed.screen.queryByTestId('route-near-suggestions')).toBeNull())

    const noCoords = await renderBlock([point('x', null)])
    expect(noCoords.screen.queryByTestId('route-near-suggestions')).toBeNull()
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})

const originalFeatureFlag = process.env.EXPO_PUBLIC_AI_PICKS
beforeEach(() => { process.env.EXPO_PUBLIC_AI_PICKS = '1' })
afterAll(() => {
  if (originalFeatureFlag === undefined) delete process.env.EXPO_PUBLIC_AI_PICKS
  else process.env.EXPO_PUBLIC_AI_PICKS = originalFeatureFlag
})
