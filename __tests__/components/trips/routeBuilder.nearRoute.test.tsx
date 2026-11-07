/**
 * #2911: конструктор маршрута добавляет точку из карточки «Рядом с маршрутом»: статья —
 * «Место» с `placeId`, квест — обычная точка с координатами источника. Сам блок
 * заглушён (его состояния — `routeNearSuggestions.test.tsx`), проверяется контракт
 * `onAddPoint` → маршрут → сохранение.
 */
process.env.EXPO_PUBLIC_AI_PICKS = '1'

import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'

import type { PlannedTrip } from '@/api/plannedTrips'
import type { AiPickItem } from '@/api/aiPicks'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'
import { createQueryWrapper } from '../../helpers/testQueryClient'

const mockMutate = jest.fn()

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  useRouteTemplates: () => ({ data: [] }),
  useTripRouteElevation: () => ({ data: undefined }),
  useRefreshTripRouteElevation: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateTripRoute: () => ({ mutate: mockMutate, isPending: false }),
  useUpdateTripTransport: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateTripBikeType: () => ({ mutate: jest.fn(), isPending: false }),
}))

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

const mockQuest: AiPickItem = {
  type: 'quest',
  source_id: 5,
  title: 'Квест по Гродно',
  url: 'https://metravel.by/quests/5',
  path: '/quests/5',
  snippet: 'Старый замок и Неман',
  score: null,
  city: 'Гродно',
  country: 'Беларусь',
  lat: 53.68,
  lng: 23.83,
  cover: null,
}
const mockArticle: AiPickItem = { ...mockQuest, type: 'travel', source_id: 816, title: 'Лида за день', url: 'https://metravel.by/travels/lida', path: '/travels/lida', lat: 53.89, lng: 25.3 }

jest.mock('@/components/trips/planning/RouteNearSuggestions', () => {
  const React = require('react')
  const { Pressable, Text } = require('react-native')
  return {
    __esModule: true,
    default: ({ onAddPoint, route }: { onAddPoint: (item: AiPickItem) => void; route: unknown[] }) =>
      React.createElement(
        React.Fragment,
        null,
        React.createElement(Text, { testID: 'near-stub-count' }, String(route.length)),
        React.createElement(Pressable, { testID: 'near-stub-add-quest', onPress: () => onAddPoint(mockQuest) }, React.createElement(Text, null, 'q')),
        React.createElement(Pressable, { testID: 'near-stub-add-article', onPress: () => onAddPoint(mockArticle) }, React.createElement(Text, null, 'a')),
      ),
  }
})

const makeTrip = (): PlannedTrip => ({
  id: 8002,
  slug: '8002',
  title: 'Тестовая поездка',
  description: '',
  startDate: '2026-07-11',
  endDate: null,
  startTime: '08:00',
  transport: 'car',
  bikeType: null,
  visibility: 'public',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 1, name: 'Организатор', avatarUrl: null },
  route: [{ id: 'minsk', type: 'custom', name: 'Минск', description: null, coordinates: [27.56, 53.9], placeId: null }],
  routeGeometry: null,
  routeSummary: null,
  routingState: null,
  participants: [],
  coverUrl: null,
  region: 'Минск',
  publishedToCommunity: false,
  report: null,
  isOwner: true,
  myRsvp: 'going',
  createdAt: '2026-07-01T10:00:00.000Z',
})

beforeEach(() => mockMutate.mockClear())

describe('RouteBuilder: точка из «Рядом с маршрутом» (#2911)', () => {
  it('квест → обычная точка, статья → «Место» с placeId; обе с координатами источника уходят в сохранение', async () => {
    const { findByTestId, getByTestId } = await render(<RouteBuilder trip={makeTrip()} />, { wrapper: createQueryWrapper().Wrapper })
    const stub = await findByTestId('near-stub-count')
    expect(stub.props.children).toBe('1')

    await fireEvent.press(getByTestId('near-stub-add-quest'))
    await fireEvent.press(getByTestId('near-stub-add-article'))
    await waitFor(() => expect(getByTestId('near-stub-count').props.children).toBe('3'))
    expect(getByTestId('route-builder-point-1')).toBeTruthy()
    expect(getByTestId('route-builder-point-2')).toBeTruthy()

    await fireEvent.press(getByTestId('route-builder-save'))
    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1))
    const { route } = mockMutate.mock.calls[0][0]
    expect(route).toHaveLength(3)
    expect(route[1]).toMatchObject({ type: 'custom', name: 'Квест по Гродно', description: 'Старый замок и Неман', coordinates: [23.83, 53.68], placeId: null })
    expect(route[2]).toMatchObject({ type: 'place', name: 'Лида за день', coordinates: [25.3, 53.89], placeId: 816 })
  })
})
