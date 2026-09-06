// #1824: ответ «Сохранить маршрут» применялся безусловно, и правка, сделанная
// пока PUT летел на сервер, молча исчезала — экран откатывался к тому, что
// ушло. У соседней мутации в том же файле (перестроение маршрута при смене
// транспорта) гард был, у сохранения — нет.
//
// Набор держит обе половины правила: ответ применяется на неизменившемся
// черновике и не применяется на разошедшемся, а повтор нажатия в одном тике не
// отправляет второй PUT.

import React from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'

import type { PlannedTrip } from '@/api/plannedTrips'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'
import { createQueryWrapper } from '../../helpers/testQueryClient'

const mockRouteMutate = jest.fn()
const mockTransportMutate = jest.fn()
let mockRoutePending = false

jest.mock('@/api/places', () => ({
  fetchPlacesCatalog: jest.fn(),
}))

jest.mock('@/api/travelsApi', () => ({
  fetchTravels: jest.fn(),
}))

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  useRouteTemplates: () => ({ data: [] }),
  useTripRouteElevation: () => ({ data: undefined }),
  useRefreshTripRouteElevation: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateTripRoute: () => ({
    mutate: mockRouteMutate,
    isPending: mockRoutePending,
  }),
  useUpdateTripTransport: () => ({
    mutate: mockTransportMutate,
    isPending: false,
  }),
  useUpdateTripBikeType: () => ({ mutate: jest.fn(), isPending: false }),
}))

jest.mock('@/components/ui/ImageCardMedia', () => {
  return function ImageCardMedia() {
    const { View } = require('react-native')
    return <View />
  }
})

// Живое превью ходит в сеть за дорогой; здесь оно не предмет проверки.
jest.mock('@/components/trips/planning/TripRoutePreviewEngine', () => {
  return function TripRoutePreviewEngine() {
    const { View } = require('react-native')
    return <View testID="trip-route-preview-engine" />
  }
})

jest.mock('@/components/trips/planning/TripPlanRouteMap', () => {
  return function TripPlanRouteMap({ route }: { route?: Array<{ name: string }> }) {
    const { Text, View } = require('react-native')
    return (
      <View testID="trip-plan-route-map">
        <Text testID="route-map-point-names">{route?.map((point) => point.name).join('|')}</Text>
      </View>
    )
  }
})

const makeTrip = (overrides: Partial<PlannedTrip> = {}): PlannedTrip => ({
  id: 42,
  slug: '42',
  title: 'Маршрут',
  description: '',
  startDate: '2026-08-08',
  startTime: '09:00',
  transport: 'car',
  bikeType: 'regular',
  visibility: 'private',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 7, name: 'Owner', avatarUrl: null },
  route: [
    { id: 'a', type: 'custom', name: 'A', description: null, coordinates: [27.56, 53.9], placeId: null },
    { id: 'b', type: 'custom', name: 'B', description: null, coordinates: [27.4, 53.8], placeId: null },
  ],
  routeGeometry: [[27.56, 53.9], [27.4, 53.8]],
  routeSummary: {
    distanceKm: 18.5,
    durationMin: 20,
    elevationGainM: 140,
    stopsCount: 1,
    provider: 'ors',
  },
  routingState: {
    provider: 'ors',
    isOptimal: true,
    fallbackReason: null,
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

type MutationCallbacks = {
  onSuccess: (trip: PlannedTrip) => void
  onError: () => void
  onSettled: () => void
}

const renderRouteBuilder = (element: React.ReactElement) =>
  render(element, { wrapper: createQueryWrapper().Wrapper })

/** Добавляет точку с указанным именем через панель «Точки маршрута». */
const addCustomPoint = (getByTestId: (id: string) => any, name: string) => {
  fireEvent.press(getByTestId('route-builder-add-action'))
  fireEvent.press(getByTestId('route-builder-type-custom'))
  fireEvent.changeText(getByTestId('route-builder-name'), name)
  fireEvent.press(getByTestId('route-builder-add'))
}

describe('RouteBuilder route save race (#1824)', () => {
  beforeEach(() => {
    mockRouteMutate.mockReset()
    mockTransportMutate.mockReset()
    mockRoutePending = false
  })

  it('не затирает правку, сделанную пока PUT сохранения летел на сервер', () => {
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    // Правка, которую пользователь сохраняет.
    addCustomPoint(getByTestId, 'C')
    fireEvent.press(getByTestId('route-builder-save'))
    expect(mockRouteMutate).toHaveBeenCalledTimes(1)
    expect(mockRouteMutate.mock.calls[0][0].route.map((p: { name: string }) => p.name))
      .toEqual(['A', 'B', 'C'])

    // Пока запрос летит, пользователь добавляет ещё одну точку.
    addCustomPoint(getByTestId, 'D')
    expect(getByTestId('route-map-point-names').props.children).toBe('A|B|C|D')

    // Ответ описывает маршрут БЕЗ последней правки.
    const savedTrip = makeTrip({
      route: [
        { id: 'server-a', type: 'custom', name: 'A', description: null, coordinates: [27.56, 53.9], placeId: null },
        { id: 'server-b', type: 'custom', name: 'B', description: null, coordinates: [27.4, 53.8], placeId: null },
        { id: 'server-c', type: 'custom', name: 'C', description: null, coordinates: null, placeId: null },
      ],
    })
    const callbacks = mockRouteMutate.mock.calls[0][1] as MutationCallbacks
    act(() => {
      callbacks.onSuccess(savedTrip)
      callbacks.onSettled()
    })

    expect(getByTestId('route-map-point-names').props.children).toBe('A|B|C|D')
  })

  it('расхождение не тихое: кнопка сохранения остаётся, и повтор шлёт весь черновик', () => {
    const initialTrip = makeTrip()
    const { getByTestId, rerender } = renderRouteBuilder(<RouteBuilder trip={initialTrip} />)

    addCustomPoint(getByTestId, 'C')
    fireEvent.press(getByTestId('route-builder-save'))
    addCustomPoint(getByTestId, 'D')

    const savedTrip = makeTrip({
      route: [
        { id: 'server-a', type: 'custom', name: 'A', description: null, coordinates: [27.56, 53.9], placeId: null },
        { id: 'server-b', type: 'custom', name: 'B', description: null, coordinates: [27.4, 53.8], placeId: null },
        { id: 'server-c', type: 'custom', name: 'C', description: null, coordinates: null, placeId: null },
      ],
    })
    const callbacks = mockRouteMutate.mock.calls[0][1] as MutationCallbacks
    act(() => {
      callbacks.onSuccess(savedTrip)
      callbacks.onSettled()
    })
    // Кэш поездки обновился ответом сервера — экран получает новый `trip`.
    rerender(<RouteBuilder trip={savedTrip} />)

    // Кнопка на месте: несохранённая правка видна пользователю, а не потеряна.
    fireEvent.press(getByTestId('route-builder-save'))
    expect(mockRouteMutate).toHaveBeenCalledTimes(2)
    expect(mockRouteMutate.mock.calls[1][0].route.map((p: { name: string }) => p.name))
      .toEqual(['A', 'B', 'C', 'D'])
  })

  it('без параллельной правки ответ сервера применяется и подхватывает серверные id', () => {
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    addCustomPoint(getByTestId, 'C')
    fireEvent.press(getByTestId('route-builder-save'))

    const savedTrip = makeTrip({
      route: [
        { id: 'server-a', type: 'custom', name: 'A', description: null, coordinates: [27.56, 53.9], placeId: null },
        { id: 'server-b', type: 'custom', name: 'B', description: null, coordinates: [27.4, 53.8], placeId: null },
        { id: 'server-c', type: 'custom', name: 'C-server', description: null, coordinates: null, placeId: null },
      ],
    })
    const callbacks = mockRouteMutate.mock.calls[0][1] as MutationCallbacks
    act(() => {
      callbacks.onSuccess(savedTrip)
      callbacks.onSettled()
    })

    // Имя из ответа доказывает, что применился именно серверный маршрут.
    expect(getByTestId('route-map-point-names').props.children).toBe('A|B|C-server')
  })

  it('повтор нажатия в одном тике отправляет ровно один PUT', () => {
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    addCustomPoint(getByTestId, 'C')
    fireEvent.press(getByTestId('route-builder-save'))
    fireEvent.press(getByTestId('route-builder-save'))

    expect(mockRouteMutate).toHaveBeenCalledTimes(1)
  })

  it('смена транспорта не стартует, пока сохранение маршрута ещё не завершилось', () => {
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    addCustomPoint(getByTestId, 'C')
    fireEvent.press(getByTestId('route-builder-save'))

    fireEvent.press(getByTestId('segmented-foot'))
    expect(mockTransportMutate).not.toHaveBeenCalled()

    const callbacks = mockRouteMutate.mock.calls[0][1] as MutationCallbacks
    act(() => {
      callbacks.onSuccess(makeTrip())
      callbacks.onSettled()
    })

    fireEvent.press(getByTestId('segmented-foot'))
    expect(mockTransportMutate).toHaveBeenCalledTimes(1)
  })
})
