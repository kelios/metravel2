/**
 * #1553: форма «Предложить место» стартовала с типа `place` и отправляла точку
 * с `placeId: null`. `pointTypeToBe` переводит `place` → `travel`, предложение
 * уходило как `point_type: 'travel', travel: null`, и бэкенд
 * (`validate_route_point_attrs`) отклонял его с 400 — отказ получал каждый, кто
 * не переключил чип вручную. Тесты держат сам инвариант: форма предложения не
 * умеет отправить точку с типом `place` без привязки к сущности MeTravel.
 */
import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import type { PlannedTrip } from '@/api/plannedTrips'
import TripSuggestPointForm from '@/components/trips/planning/TripSuggestPointForm'

const mockSuggestMutate = jest.fn()

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  useSuggestPoint: () => ({ mutate: mockSuggestMutate, isPending: false }),
}))

const makeTrip = (): PlannedTrip => ({
  id: 8002,
  slug: '8002',
  title: 'Тестовая поездка',
  description: '',
  startDate: '2026-07-11',
  startTime: '08:00',
  transport: 'car',
  visibility: 'public',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 1, name: 'Организатор', avatarUrl: null },
  route: [],
  routeGeometry: null,
  routeSummary: null,
  routingState: null,
  participants: [],
  coverUrl: null,
  region: 'Минск',
  publishedToCommunity: false,
  report: null,
  // Блок предложения виден только не-владельцу.
  isOwner: false,
  myRsvp: 'going',
  createdAt: '2026-07-01T10:00:00.000Z',
})

type Queries = ReturnType<typeof render>

const fillPoint = ({ getByTestId }: Queries) => {
  fireEvent.changeText(getByTestId('trip-suggest-name'), 'Костёл в Гервятах')
  fireEvent.changeText(getByTestId('trip-suggest-lat'), '54.7519')
  fireEvent.changeText(getByTestId('trip-suggest-lng'), '26.1447')
}

beforeEach(() => {
  mockSuggestMutate.mockClear()
})

describe('TripSuggestPointForm point type binding', () => {
  it('does not offer the place type: the form has no MeTravel binding at all', () => {
    const { getByTestId, queryByTestId } = render(<TripSuggestPointForm trip={makeTrip()} />)

    expect(queryByTestId('trip-suggest-type-place')).toBeNull()
    expect(getByTestId('trip-suggest-type-custom')).toBeTruthy()
    expect(getByTestId('trip-suggest-type-rest')).toBeTruthy()
    expect(getByTestId('trip-suggest-type-overnight')).toBeTruthy()
  })

  it('sends a coordinate point with the untouched default type', () => {
    const queries = render(<TripSuggestPointForm trip={makeTrip()} />)

    fillPoint(queries)
    fireEvent.press(queries.getByTestId('trip-suggest-submit'))

    expect(mockSuggestMutate).toHaveBeenCalledTimes(1)
    expect(mockSuggestMutate.mock.calls[0][0]).toMatchObject({
      tripId: 8002,
      point: {
        type: 'custom',
        name: 'Костёл в Гервятах',
        coordinates: [26.1447, 54.7519],
        placeId: null,
      },
    })
  })

  it.each(['custom', 'rest', 'overnight'] as const)(
    'never sends type place without a placeId — chip %s',
    (option) => {
      const queries = render(<TripSuggestPointForm trip={makeTrip()} />)

      fireEvent.press(queries.getByTestId(`trip-suggest-type-${option}`))
      fillPoint(queries)
      fireEvent.press(queries.getByTestId('trip-suggest-submit'))

      expect(mockSuggestMutate).toHaveBeenCalledTimes(1)
      const { point } = mockSuggestMutate.mock.calls[0][0]
      expect(point.type).toBe(option)
      expect(point.placeId).toBeNull()
      expect(point.type).not.toBe('place')
    },
  )

  it('refuses a point without coordinates with a readable reason instead of a 400', () => {
    const { getByTestId, queryByTestId } = render(<TripSuggestPointForm trip={makeTrip()} />)

    fireEvent.changeText(getByTestId('trip-suggest-name'), 'Точка без координат')
    fireEvent.press(getByTestId('trip-suggest-submit'))

    expect(mockSuggestMutate).not.toHaveBeenCalled()
    expect(queryByTestId('trip-suggest-error')).toBeTruthy()
    expect(getByTestId('trip-suggest-error')).toHaveTextContent(
      'Укажите широту от -90 до 90 и долготу от -180 до 180.',
    )
  })

  it('refuses coordinates outside the valid range', () => {
    const { getByTestId } = render(<TripSuggestPointForm trip={makeTrip()} />)

    fireEvent.changeText(getByTestId('trip-suggest-name'), 'Точка за полюсом')
    fireEvent.changeText(getByTestId('trip-suggest-lat'), '154.75')
    fireEvent.changeText(getByTestId('trip-suggest-lng'), '26.1447')
    fireEvent.press(getByTestId('trip-suggest-submit'))

    expect(mockSuggestMutate).not.toHaveBeenCalled()
    expect(getByTestId('trip-suggest-error')).toBeTruthy()
  })

  it('accepts a comma decimal separator in coordinates', () => {
    const { getByTestId } = render(<TripSuggestPointForm trip={makeTrip()} />)

    fireEvent.changeText(getByTestId('trip-suggest-name'), 'Мирский замок')
    fireEvent.changeText(getByTestId('trip-suggest-lat'), '53,4511')
    fireEvent.changeText(getByTestId('trip-suggest-lng'), '26,4731')
    fireEvent.press(getByTestId('trip-suggest-submit'))

    expect(mockSuggestMutate).toHaveBeenCalledTimes(1)
    expect(mockSuggestMutate.mock.calls[0][0].point.coordinates).toEqual([26.4731, 53.4511])
  })
})
