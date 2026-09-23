// #1899 — «Предложить оптимальный порядок» в шаге «Точки маршрута» конструктора.
import React from 'react'
import { act, fireEvent, render, within } from '@testing-library/react-native'

import type { PlannedTrip } from '@/api/plannedTrips'
import type { RouteOrderResponse } from '@/api/routeOrderOptimization'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'
import { createQueryWrapper } from '../../helpers/testQueryClient'

const mockRouteMutate = jest.fn()
const mockOptimizeRouteOrder = jest.fn()

jest.mock('@/api/routeOrderOptimization', () => ({
  ...jest.requireActual('@/api/routeOrderOptimization'),
  optimizeRouteOrder: (...args: unknown[]) => mockOptimizeRouteOrder(...args),
}))

jest.mock('@/api/places', () => ({ fetchPlacesCatalog: jest.fn() }))
jest.mock('@/api/travelsApi', () => ({ fetchTravels: jest.fn() }))

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  useRouteTemplates: () => ({ data: [] }),
  useTripRouteElevation: () => ({ data: undefined }),
  useRefreshTripRouteElevation: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateTripRoute: () => ({ mutate: mockRouteMutate, isPending: false }),
  useUpdateTripTransport: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateTripBikeType: () => ({ mutate: jest.fn(), isPending: false }),
}))

jest.mock('@/utils/tripAnalytics', () => ({
  trackRouteExported: jest.fn(),
  trackRoutePointAdded: jest.fn(),
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

// Карта здесь — свидетель черновика: пока владелец не нажал «Применить», она
// обязана показывать прежний порядок.
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

const makeRoute = (length: number) =>
  Array.from({ length }, (_, index) => ({
    id: `p${index}`,
    type: 'custom' as const,
    name: `Point ${index + 1}`,
    description: null,
    coordinates: [27.5 + index * 0.4, 53.9 - index * 0.2] as [number, number],
    placeId: null,
  }))

const makeTrip = (overrides: Partial<PlannedTrip> = {}): PlannedTrip => ({
  id: 42,
  slug: '42',
  title: 'Велопоход',
  description: '',
  startDate: '2026-09-20',
  startTime: '09:00',
  transport: 'bike',
  bikeType: 'road',
  visibility: 'private',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 7, name: 'Owner', avatarUrl: null },
  route: makeRoute(6),
  routeGeometry: null,
  routeSummary: null,
  routingState: null,
  participants: [],
  coverUrl: null,
  region: '',
  publishedToCommunity: false,
  report: null,
  isOwner: true,
  myRsvp: 'going',
  createdAt: '2026-09-16T08:00:00Z',
  ...overrides,
})

const answer = (order: number[]): RouteOrderResponse => ({
  order,
  provider: 'ors',
  is_optimized: true,
  objective: 'duration',
  fallback_reason: null,
  warnings: ['optimality_not_guaranteed', 'improvement_not_measured'],
})

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

const names = (length: number, order: number[] = Array.from({ length }, (_, index) => index)) =>
  order.map((index) => `Point ${index + 1}`).join('|')

const renderRouteBuilder = (trip: PlannedTrip) =>
  render(<RouteBuilder trip={trip} />, { wrapper: createQueryWrapper().Wrapper })

const SUGGESTED = [0, 3, 1, 4, 2, 5]

describe('RouteBuilder route order suggestion', () => {
  beforeEach(() => {
    mockRouteMutate.mockReset()
    mockOptimizeRouteOrder.mockReset()
  })

  it('is not offered for one or two points, to a guest, or for an unroutable transport', () => {
    const short = renderRouteBuilder(makeTrip({ route: makeRoute(2) }))
    expect(short.queryByTestId('route-order-suggestion')).toBeNull()
    short.unmount()

    const guest = renderRouteBuilder(makeTrip({ isOwner: false }))
    expect(guest.queryByTestId('route-order-suggestion')).toBeNull()
    guest.unmount()

    const publicTransport = renderRouteBuilder(makeTrip({ transport: 'public', bikeType: null }))
    expect(publicTransport.queryByTestId('route-order-suggestion')).toBeNull()
  })

  // #2053: в колонке телефона 288–332 px подпись обрезалась до «Предложить
  // оптимальный пор…». Она переносится на вторую строку, а не режется.
  it('wraps the action label onto a second line instead of clipping it', () => {
    const { getByTestId } = renderRouteBuilder(makeTrip())

    const label = within(getByTestId('route-order-suggest')).getByText('Предложить оптимальный порядок')
    expect(label.props.numberOfLines).toBe(2)
  })

  it('explains why three points cannot be reordered and sends nothing', () => {
    const { getByTestId, getByText } = renderRouteBuilder(makeTrip({ route: makeRoute(3) }))

    expect(getByTestId('route-order-suggest')).toBeDisabled()
    expect(
      getByText('Первая и последняя точки остаются на месте, поэтому порядок подбирается от четырёх точек.'),
    ).toBeTruthy()
    fireEvent.press(getByTestId('route-order-suggest'))
    expect(mockOptimizeRouteOrder).not.toHaveBeenCalled()
  })

  it('requires coordinates on every point', () => {
    const route = makeRoute(5)
    route[2] = { ...route[2], coordinates: null as unknown as [number, number] }
    const { getByTestId, getByText } = renderRouteBuilder(makeTrip({ route }))

    expect(getByTestId('route-order-suggest')).toBeDisabled()
    expect(getByText('Чтобы подобрать порядок, у каждой точки должны быть координаты.')).toBeTruthy()
  })

  it('sends one snapshot request and previews the order without touching the draft', async () => {
    const pending = deferred<RouteOrderResponse>()
    mockOptimizeRouteOrder.mockReturnValue(pending.promise)
    const { getByTestId, queryByTestId } = renderRouteBuilder(makeTrip())

    fireEvent.press(getByTestId('route-order-suggest'))
    fireEvent.press(getByTestId('route-order-suggest'))

    expect(mockOptimizeRouteOrder).toHaveBeenCalledTimes(1)
    expect(mockOptimizeRouteOrder).toHaveBeenCalledWith({
      points: makeRoute(6).map(({ coordinates: [lng, lat] }) => ({ lat, lng })),
      transport_mode: 'bike',
      bike_type: 'road',
    })
    expect(getByTestId('route-order-suggest')).toBeDisabled()

    await act(async () => {
      pending.resolve(answer(SUGGESTED))
    })

    expect(getByTestId('route-order-preview')).toBeTruthy()
    expect(queryByTestId('route-order-suggest')).toBeNull()
    expect(getByTestId('route-order-preview-row-1')).toHaveTextContent('2Point 4было 4', { exact: false })
    expect(getByTestId('route-order-preview-row-0')).not.toHaveTextContent('было', { exact: false })
    expect(getByTestId('route-map-point-names').props.children).toBe(names(6))
    expect(queryByTestId('route-order-preview-days-hint')).toBeNull()
  })

  it('applies the suggested order to the draft and saves the reordered list', async () => {
    mockOptimizeRouteOrder.mockResolvedValue(answer(SUGGESTED))
    const { getByTestId, queryByTestId, getByText } = renderRouteBuilder(makeTrip())

    await act(async () => {
      fireEvent.press(getByTestId('route-order-suggest'))
    })
    fireEvent.press(getByTestId('route-order-apply'))

    expect(queryByTestId('route-order-preview')).toBeNull()
    expect(getByTestId('route-map-point-names').props.children).toBe(names(6, SUGGESTED))
    expect(getByText('Порядок применён. Сохраните маршрут, чтобы не потерять изменения.')).toBeTruthy()

    fireEvent.press(getByTestId('route-builder-save'))
    expect(mockRouteMutate).toHaveBeenCalledTimes(1)
    const [payload] = mockRouteMutate.mock.calls[0] as [{ route: Array<{ name: string }> }]
    expect(payload.route.map((point) => point.name).join('|')).toBe(names(6, SUGGESTED))
  })

  it('keeps the open point editor on its own point after applying', async () => {
    mockOptimizeRouteOrder.mockResolvedValue(answer(SUGGESTED))
    const { getByTestId } = renderRouteBuilder(makeTrip())

    fireEvent.press(getByTestId('route-builder-edit-3'))
    expect(getByTestId('route-builder-edit-name').props.value).toBe('Point 4')

    await act(async () => {
      fireEvent.press(getByTestId('route-order-suggest'))
    })
    fireEvent.press(getByTestId('route-order-apply'))

    expect(getByTestId('route-builder-edit-name').props.value).toBe('Point 4')
    fireEvent.changeText(getByTestId('route-builder-edit-name'), 'Point 4 edited')
    fireEvent.press(getByTestId('route-builder-edit-save'))
    expect(getByTestId('route-map-point-names').props.children).toBe(
      names(6, SUGGESTED).replace('Point 4', 'Point 4 edited'),
    )
  })

  it('dismisses the preview and keeps the manual order', async () => {
    mockOptimizeRouteOrder.mockResolvedValue(answer(SUGGESTED))
    const { getByTestId, queryByTestId } = renderRouteBuilder(makeTrip())

    await act(async () => {
      fireEvent.press(getByTestId('route-order-suggest'))
    })
    fireEvent.press(getByTestId('route-order-dismiss'))

    expect(queryByTestId('route-order-preview')).toBeNull()
    expect(getByTestId('route-order-suggest')).not.toBeDisabled()
    expect(getByTestId('route-map-point-names').props.children).toBe(names(6))
  })

  it('reports an unchanged order without offering to apply it', async () => {
    mockOptimizeRouteOrder.mockResolvedValue(answer([0, 1, 2, 3, 4, 5]))
    const { getByTestId, queryByTestId, getByText } = renderRouteBuilder(makeTrip())

    await act(async () => {
      fireEvent.press(getByTestId('route-order-suggest'))
    })

    expect(queryByTestId('route-order-apply')).toBeNull()
    expect(getByText('Сервис не нашёл порядка лучше текущего.')).toBeTruthy()
  })

  it('shows a readable backend error and keeps the manual order', async () => {
    mockOptimizeRouteOrder.mockRejectedValue(
      Object.assign(new Error('HTTP 503'), { status: 503, data: { code: 'provider_not_configured' } }),
    )
    const { getByTestId, queryByTestId } = renderRouteBuilder(makeTrip())

    await act(async () => {
      fireEvent.press(getByTestId('route-order-suggest'))
    })

    expect(getByTestId('route-order-error')).toHaveTextContent(
      'Сервис подбора порядка сейчас недоступен. Попробуйте позже.',
    )
    expect(queryByTestId('route-order-preview')).toBeNull()
    expect(getByTestId('route-order-suggest')).not.toBeDisabled()
    expect(getByTestId('route-map-point-names').props.children).toBe(names(6))
  })

  it('drops an answer that arrives after the draft changed', async () => {
    const pending = deferred<RouteOrderResponse>()
    mockOptimizeRouteOrder.mockReturnValue(pending.promise)
    const { getByTestId, queryByTestId } = renderRouteBuilder(makeTrip())

    fireEvent.press(getByTestId('route-order-suggest'))
    fireEvent.press(getByTestId('route-builder-edit-3'))
    fireEvent.press(getByTestId('route-builder-move-down-3'))

    await act(async () => {
      pending.resolve(answer(SUGGESTED))
    })

    expect(queryByTestId('route-order-preview')).toBeNull()
    expect(queryByTestId('route-order-apply')).toBeNull()
    expect(getByTestId('route-order-suggest')).not.toBeDisabled()
    expect(getByTestId('route-map-point-names').props.children).toBe(names(6, [0, 1, 2, 4, 3, 5]))
  })

  it('warns that point days stay as they are when the route is split by day', async () => {
    mockOptimizeRouteOrder.mockResolvedValue(answer(SUGGESTED))
    const route = makeRoute(6).map((point, index) => ({ ...point, dayNumber: index < 3 ? 1 : 2 }))
    const { getByTestId } = renderRouteBuilder(makeTrip({ route }))

    await act(async () => {
      fireEvent.press(getByTestId('route-order-suggest'))
    })

    expect(getByTestId('route-order-preview-days-hint')).toBeTruthy()
  })
})
