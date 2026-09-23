// #2065 P2-1/P2-2 — прод-приёмка 2026-09-24: клик по «Повторить» сохранённого
// маршрута слал ДВА `POST /api/trips/{id}/route-summary/` вместо одного,
// потому что `useSavedRouteRetry` (эта карточка) и тихий автопересчёт высот
// `useTripRouteElevationRefresh` (#1825) держат каждый свой независимый
// `useMutation` на `useRefreshTripRouteElevation`, а успешный ответ ретрая
// пишет в общий кэш `tripRouteElevation` данные, которые сам же авто-эффект
// (`provider:'ors', preview/polyline:null`, штатный триггер #1825 —
// `routeBuilder.elevation.test.tsx`, кейс «recalculates once when a routed
// summary was saved without elevation») читает как повод пересчитать заново.
//
// В отличие от удалённого `usePlannedTripsApi.refreshDedupe.test.tsx`, здесь
// НЕ мокается весь `@/hooks/usePlannedTripsApi` — обе мутации настоящие, мок
// только на сетевых функциях `@/api/plannedTrips`, поэтому тест воспроизводит
// именно ту интеракцию, которую пропустили мок-фикстуры #2058/#2059/#2060
// (`provider:'fallback'`, авто-эффект там никогда не срабатывает).
import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'

import type { PlannedTrip, RoutePoint, TripRouteElevation } from '@/api/plannedTrips'
import { queryKeys } from '@/api/queryKeys'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'
import { useAuthStore } from '@/stores/authStore'
import { createQueryWrapper } from '../../helpers/testQueryClient'

jest.mock('@/api/places', () => ({ fetchPlacesCatalog: jest.fn() }))
jest.mock('@/api/travelsApi', () => ({ fetchTravels: jest.fn() }))

const mockFetchElevation = jest.fn()
const mockRefreshElevation = jest.fn()

// #2065 P2-1: только сетевые функции мокнуты — `useRefreshTripRouteElevation`
// (обе мутации, ручная и авто) и `useTripRouteElevation` (GET) настоящие,
// делят один и тот же QueryClient, как в реальном RouteBuilder.
jest.mock('@/api/plannedTrips', () => ({
  ...jest.requireActual('@/api/plannedTrips'),
  fetchTripRouteElevation: (...args: unknown[]) => mockFetchElevation(...args),
  refreshTripRouteElevation: (...args: unknown[]) => mockRefreshElevation(...args),
  fetchRouteTemplates: async () => [],
}))

jest.mock('@/components/ui/ImageCardMedia', () => {
  return function ImageCardMedia() {
    const { View } = require('react-native')
    return <View />
  }
})

jest.mock('@/components/trips/planning/TripRoutePreviewEngine', () => {
  return function TripRoutePreviewEngine() {
    const { View } = require('react-native')
    return <View testID="trip-route-preview-engine" />
  }
})

jest.mock('@/components/trips/planning/TripPlanRouteMap', () => {
  return function TripPlanRouteMap() {
    const { View } = require('react-native')
    return <View testID="trip-plan-route-map" />
  }
})

jest.mock('@/components/trips/planning/TripRouteImportPanel', () => {
  return function TripRouteImportPanel() {
    const { View } = require('react-native')
    return <View testID="trip-route-import-panel" />
  }
})

jest.mock('@/components/MapPage/AddressSearch', () => {
  return function AddressSearch() {
    const { View } = require('react-native')
    return <View testID="route-builder-address-search" />
  }
})

const route: RoutePoint[] = [
  { id: 'a', type: 'custom', name: 'A', description: null, coordinates: [19.9496, 49.2992], placeId: null },
  { id: 'b', type: 'custom', name: 'B', description: null, coordinates: [20.108, 49.32], placeId: null },
]

const makeTrip = (overrides: Partial<PlannedTrip> = {}): PlannedTrip => ({
  id: 590059,
  slug: '590059',
  title: 'Деградированный маршрут',
  description: '',
  startDate: '2026-08-08',
  startTime: '09:00',
  transport: 'foot',
  bikeType: null,
  visibility: 'private',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 7, name: 'Owner', avatarUrl: null },
  route,
  routeGeometry: route.map((point) => point.coordinates as [number, number]),
  routeSummary: {
    distanceKm: 12,
    durationMin: 0,
    elevationGainM: 0,
    stopsCount: 2,
    provider: 'direct',
  },
  routingState: {
    provider: 'direct',
    isOptimal: false,
    fallbackReason: 'ors_http_502',
    warnings: [],
  },
  participants: [],
  coverUrl: null,
  region: '',
  publishedToCommunity: false,
  report: null,
  isOwner: true,
  myRsvp: 'going',
  createdAt: '2026-08-08T08:00:00Z',
  ...overrides,
})

// Начальный `route-summary`: тот же деградированный `provider`, что и у
// `routing_state` поездки — авто-эффект #1825 требует `provider==='ors'`,
// поэтому на старте (до ретрая) он молчит независимо от фикса.
const degradedElevation: TripRouteElevation = {
  status: 'degraded',
  provider: 'direct',
  ascentM: null,
  descentM: null,
  preview: null,
  geometry: null,
  calculatedAt: null,
}

// Ответ ручного `force_refresh`: ORS восстановился (маршрут построен), но
// профиль высот/полилиния ещё не готовы — ровно то состояние, на котором
// #1825 уже штатно стреляет (`routeBuilder.elevation.test.tsx`).
const healthyOrsWithoutProfile: TripRouteElevation = {
  status: 'ready',
  provider: 'ors',
  ascentM: 120,
  descentM: 80,
  preview: null,
  geometry: null,
  calculatedAt: '2026-09-24T00:00:00Z',
}

describe('RouteBuilder — «Повторить» и автопересчёт высот не дублируют запрос (#2065 P2)', () => {
  const originalAuth = useAuthStore.getState()

  beforeEach(() => {
    mockFetchElevation.mockReset()
    mockRefreshElevation.mockReset()
    mockFetchElevation.mockResolvedValue(degradedElevation)
    mockRefreshElevation.mockResolvedValue(healthyOrsWithoutProfile)
    // `useTripRouteElevation` требует настоящую сессию (`isAuthenticated`) —
    // без мока хука #2065 P2-2 её не обойти, как в остальных RouteBuilder-тестах.
    useAuthStore.setState({ authReady: true, isAuthenticated: true, userId: '7' })
  })

  afterEach(() => {
    useAuthStore.setState(originalAuth, true)
  })

  it('клик по «Повторить» шлёт ровно один POST; смена транспорта после него — ещё один', async () => {
    const trip = makeTrip()
    const { queryClient, Wrapper } = createQueryWrapper()
    const { findByTestId, rerender } = render(<RouteBuilder trip={trip} layout="mapFirst" />, {
      wrapper: Wrapper,
    })

    // Начальный GET разрешился деградированным `route-summary` — авто-эффект
    // #1825 не срабатывает от него (`provider !== 'ors'`), это база отсчёта.
    await waitFor(() =>
      expect(queryClient.getQueryData(queryKeys.tripRouteElevation(trip.id))).toEqual(degradedElevation),
    )
    expect(mockRefreshElevation).not.toHaveBeenCalled()

    const retryButton = await findByTestId('route-mobile-summary-retry')
    fireEvent.press(retryButton)

    await waitFor(() => expect(mockRefreshElevation).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(queryClient.getQueryData(queryKeys.tripRouteElevation(trip.id))).toEqual(healthyOrsWithoutProfile),
    )
    // Даём авто-эффекту #1825 шанс среагировать на свежий кэш до проверки
    // стабильности счётчика — без фикса P2-1 он стреляет вторым, независимым
    // POST ровно в этот момент.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    expect(mockRefreshElevation).toHaveBeenCalledTimes(1)

    // Смена транспорта — новый ключ пересчёта (#1308): авто-эффект обязан
    // сработать заново, «Повторить» его не должен был запереть навсегда.
    rerender(<RouteBuilder trip={{ ...trip, transport: 'bike', bikeType: 'regular' }} layout="mapFirst" />)

    await waitFor(() => expect(mockRefreshElevation).toHaveBeenCalledTimes(2))
    expect(mockRefreshElevation).toHaveBeenNthCalledWith(1, trip.id)
    expect(mockRefreshElevation).toHaveBeenNthCalledWith(2, trip.id)
  })
})
