import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { Platform } from 'react-native'

import type { PlannedTrip } from '@/api/plannedTrips'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'
import { createQueryWrapper } from '../../helpers/testQueryClient'

jest.mock('@/api/places', () => ({
  fetchPlacesCatalog: jest.fn(),
}))

jest.mock('@/api/travelsApi', () => ({
  fetchTravels: jest.fn(),
}))

const mockRouteMutate = jest.fn()

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  useRouteTemplates: () => ({ data: [] }),
  useTripRouteElevation: () => ({ data: undefined }),
  useRefreshTripRouteElevation: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateTripRoute: () => ({ mutate: mockRouteMutate, isPending: false }),
  useUpdateTripTransport: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateTripBikeType: () => ({ mutate: jest.fn(), isPending: false }),
}))

jest.mock('@/components/ui/ImageCardMedia', () => {
  return function ImageCardMedia() {
    const { View } = require('react-native')
    return <View />
  }
})

jest.mock('@/components/trips/planning/TripPlanRouteMap', () => {
  return function TripPlanRouteMap() {
    const { View } = require('react-native')
    return <View testID="trip-plan-route-map" />
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
    {
      id: 'a',
      type: 'custom',
      name: 'Кафе',
      description: 'Меню тут cafe-gluboke.by/menu',
      coordinates: [27.56, 53.9],
      placeId: null,
    },
    { id: 'b', type: 'custom', name: 'B', description: null, coordinates: [27.4, 53.8], placeId: null },
  ],
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
  createdAt: '2026-08-08T08:00:00Z',
  ...overrides,
})


// #1491: шаг «Точки маршрута» рендерит общий AddressSearch с /map, а он ходит за
// адресами через React Query — конструктору нужен клиент, как и в приложении.
const renderRouteBuilder = (element: React.ReactElement) =>
  render(element, { wrapper: createQueryWrapper().Wrapper })

describe('RouteBuilder point description', () => {
  const originalPlatform = Platform.OS

  beforeEach(() => {
    mockRouteMutate.mockReset()
  })

  afterEach(() => {
    Platform.OS = originalPlatform
  })

  // #1494: однострочное поле не давало прочитать и отредактировать длинное описание.
  it('keeps the new-point description input multiline', () => {
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)
    fireEvent.press(getByTestId('route-builder-add-action'))
    // Первый тип в раскрытой форме — место; ручные поля живут
    // в «своей точке».
    fireEvent.press(getByTestId('route-builder-type-custom'))
    const input = getByTestId('route-builder-description')
    expect(input.props.multiline).toBe(true)
    expect(input.props.numberOfLines).toBe(3)
  })

  it('keeps the edited-point description input multiline', () => {
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)
    fireEvent.press(getByTestId('route-builder-edit-0'))
    const input = getByTestId('route-builder-edit-description')
    expect(input.props.multiline).toBe(true)
    expect(input.props.numberOfLines).toBe(3)
  })

  // #1494: длинное описание точки должно доезжать до сохранения маршрута целиком,
  // вместе с переносами строк — ради этого поле и стало многострочным.
  it('saves a multi-line point description with its line breaks', () => {
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)
    fireEvent.press(getByTestId('route-builder-add-action'))
    fireEvent.press(getByTestId('route-builder-type-custom'))
    fireEvent.changeText(getByTestId('route-builder-name'), 'Ночёвка')
    fireEvent.changeText(
      getByTestId('route-builder-description'),
      'Бронь на фамилию Иванов\nЗаезд с 14:00, ключи у сторожа\nСайт camp.by/booking',
    )
    fireEvent.press(getByTestId('route-builder-add'))
    fireEvent.press(getByTestId('route-builder-save'))

    expect(mockRouteMutate).toHaveBeenCalledTimes(1)
    const saved = mockRouteMutate.mock.calls[0][0].route.at(-1)
    expect(saved.name).toBe('Ночёвка')
    expect(saved.description).toBe(
      'Бронь на фамилию Иванов\nЗаезд с 14:00, ключи у сторожа\nСайт camp.by/booking',
    )
  })

  // На скрине владельца (08.09.2026, Mullerthal Trail) описание первой точки —
  // автобусы RGTR до старта — занимало в карточке полтора десятка строк и
  // выдавливало из ограниченного по высоте списка остальные точки.
  it('collapses a long point description to three lines with a per-point toggle', () => {
    const longDescription =
      'День 0. Приезд, база на старте. Автобусы RGTR 211/212 из Люксембурга ' +
      '(Kirchberg/Limpertsberg), 190/191 от вокзала Ettelbruck, 272 от Wasserbillig ' +
      '(поезд Трир–Люксембург). Проезд по Люксембургу бесплатный, билеты не нужны. ' +
      'Заселение с 15:00, ключи на ресепшене до 22:00, поздний заезд — по телефону.'
    const trip = makeTrip()
    const { getByTestId, queryByTestId } = renderRouteBuilder(
      <RouteBuilder
        trip={makeTrip({
          route: [
            { ...trip.route[0], description: longDescription },
            { ...trip.route[1], description: 'Короткая заметка.' },
          ],
        })}
      />,
    )

    expect(getByTestId('route-builder-point-description-0').props.numberOfLines).toBe(3)

    fireEvent.press(getByTestId('route-builder-point-description-toggle-0'))
    expect(getByTestId('route-builder-point-description-0').props.numberOfLines).toBeUndefined()

    // Короткому описанию соседней точки кнопка не нужна и не рисуется.
    expect(queryByTestId('route-builder-point-description-toggle-1')).toBeNull()
  })

  it('renders links inside a point description as real anchors on web', () => {
    Platform.OS = 'web'
    const { UNSAFE_getAllByProps } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)
    const anchors = UNSAFE_getAllByProps({ href: 'https://cafe-gluboke.by/menu' })
    expect(anchors.length).toBeGreaterThan(0)
  })
})
