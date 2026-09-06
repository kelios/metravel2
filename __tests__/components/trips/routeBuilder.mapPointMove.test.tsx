/**
 * #1781 — правка точки маршрута прямо с карты.
 *
 * Regression control карточки: карта не владеет маршрутом, она только сообщает
 * намерение. Тест держит три инварианта этого контракта:
 *   1. перетаскивание маркера меняет координаты РОВНО одной точки и не трогает
 *      порядок и остальные поля;
 *   2. открытый редактор этой же точки переезжает вместе с маркером — иначе
 *      «Сохранить» в нём вернуло бы точку в дотасковую позицию;
 *   3. удаление с карты убирает ту же точку, что и удаление из списка.
 */
import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import type { PlannedTrip } from '@/api/plannedTrips'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'
import { createQueryWrapper } from '../../helpers/testQueryClient'

jest.mock('@/api/places', () => ({ fetchPlacesCatalog: jest.fn() }))
jest.mock('@/api/travelsApi', () => ({ fetchTravels: jest.fn() }))

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

/**
 * Карта подменяется двумя кнопками: тест проверяет не Leaflet, а контракт
 * «карта отдала намерение — конструктор применил его к маршруту».
 */
jest.mock('@/components/trips/planning/TripPlanRouteMap', () => {
  return function TripPlanRouteMap({
    onMovePoint,
    onDeletePoint,
  }: {
    onMovePoint?: (move: { index: number; lat: number; lng: number }) => void
    onDeletePoint?: (index: number) => void
  }) {
    const { Pressable, View } = require('react-native')
    return (
      <View testID="trip-plan-route-map">
        <Pressable
          testID="map-drag-point-0"
          onPress={() => onMovePoint?.({ index: 0, lat: 53.930012345678, lng: 27.601987654321 })}
        />
        <Pressable
          testID="map-drag-point-0-invalid"
          onPress={() => onMovePoint?.({ index: 0, lat: Number.NaN, lng: 27.6 })}
        />
        <Pressable testID="map-delete-point-0" onPress={() => onDeletePoint?.(0)} />
      </View>
    )
  }
})

const makeTrip = (overrides: Partial<PlannedTrip> = {}): PlannedTrip => ({
  id: 42,
  slug: '42',
  title: 'Маршрут',
  description: '',
  startDate: '2026-09-06',
  startTime: '09:00',
  transport: 'car',
  bikeType: 'regular',
  visibility: 'private',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 7, name: 'Owner', avatarUrl: null },
  route: [
    { id: 'a', type: 'custom', name: 'Старт', description: 'Заметка', coordinates: [27.56, 53.9], placeId: null },
    { id: 'b', type: 'custom', name: 'Финиш', description: null, coordinates: [27.4, 53.8], placeId: null },
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
  createdAt: '2026-09-06T08:00:00Z',
  ...overrides,
})

const renderRouteBuilder = (element: React.ReactElement) =>
  render(element, { wrapper: createQueryWrapper().Wrapper })

describe('#1781 RouteBuilder — точка маршрута правится с карты', () => {
  beforeEach(() => {
    mockRouteMutate.mockReset()
  })

  it('перетаскивание маркера меняет координаты одной точки, сохраняя порядок и поля', () => {
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    fireEvent.press(getByTestId('map-drag-point-0'))
    fireEvent.press(getByTestId('route-builder-save'))

    expect(mockRouteMutate).toHaveBeenCalledTimes(1)
    const saved = mockRouteMutate.mock.calls[0][0].route
    expect(saved).toHaveLength(2)
    // Округление тем же шагом, что и ручной ввод координат.
    expect(saved[0].coordinates).toEqual([27.601988, 53.930012])
    expect(saved[0].name).toBe('Старт')
    expect(saved[0].description).toBe('Заметка')
    expect(saved[1].coordinates).toEqual([27.4, 53.8])
    expect(saved[1].name).toBe('Финиш')
  })

  it('нефинитная координата дропа оставляет маршрут нетронутым', () => {
    const { getByTestId, queryByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    fireEvent.press(getByTestId('map-drag-point-0-invalid'))

    // Кнопки сохранения нет вовсе, пока нет несохранённых изменений (#1491).
    expect(queryByTestId('route-builder-save')).toBeNull()
  })

  it('переносит открытый редактор точки вслед за её маркером', () => {
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    fireEvent.press(getByTestId('route-builder-edit-0'))
    expect(getByTestId('route-builder-edit-lat').props.value).toBe('53.9')

    fireEvent.press(getByTestId('map-drag-point-0'))

    expect(getByTestId('route-builder-edit-lat').props.value).toBe('53.930012')
    expect(getByTestId('route-builder-edit-lng').props.value).toBe('27.601988')

    // Сохранение открытой формы не возвращает точку в дотасковую позицию.
    fireEvent.press(getByTestId('route-builder-edit-save'))
    fireEvent.press(getByTestId('route-builder-save'))

    expect(mockRouteMutate.mock.calls[0][0].route[0].coordinates).toEqual([27.601988, 53.930012])
  })

  it('удаление с карты убирает ту же точку, что и удаление из списка', () => {
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    fireEvent.press(getByTestId('map-delete-point-0'))
    fireEvent.press(getByTestId('route-builder-save'))

    const saved = mockRouteMutate.mock.calls[0][0].route
    expect(saved).toHaveLength(1)
    expect(saved[0].name).toBe('Финиш')
  })
})
