// #1843: у точки-ночёвки появились поля брони — адрес жилья, ссылка, цена и
// время заезда. Раньше всё это писали одной строкой в описание точки, и
// отдельно кликнуть по ссылке брони или показать цену было нечем.
//
// Тест держит три вещи, ради которых задача заведена: блок брони появляется и
// исчезает по типу точки, заполненное доезжает до payload сохранения маршрута
// нормализованным, и строка точки показывает бронь настоящей ссылкой. Плюс
// regression control карточки — у точки НЕ-ночёвки полей нет и в payload ни
// одного ключа брони не уходит.
import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import type { PlannedTrip, RoutePoint } from '@/api/plannedTrips'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'
import { translate as i18nT } from '@/i18n'
import { createQueryWrapper } from '../../helpers/testQueryClient'

const mockRouteMutate = jest.fn()

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

jest.mock('@/hooks/usePlannedTripRouteFile', () => ({
  usePlannedTripRouteFile: () => ({ data: null }),
  usePlannedTripOriginalTrack: () => ({ data: null }),
  useUploadPlannedTripRouteFile: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeletePlannedTripRouteFile: () => ({ mutate: jest.fn(), isPending: false }),
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

jest.mock('@/components/trips/planning/TripPlanRouteMap', () => {
  return function TripPlanRouteMap() {
    const { View } = require('react-native')
    return <View testID="trip-plan-route-map" />
  }
})

jest.mock('@/components/trips/planning/TripRouteImportPanel', () => {
  return function TripRouteImportPanel() {
    const { View } = require('react-native')
    return <View />
  }
})

jest.mock('@/components/MapPage/AddressSearch', () => {
  return function AddressSearch() {
    const { View } = require('react-native')
    return <View />
  }
})

const makePoint = (over: Partial<RoutePoint> = {}): RoutePoint => ({
  id: 'p0',
  type: 'custom',
  name: 'Точка 1',
  description: null,
  coordinates: [6.42, 49.81],
  placeId: null,
  ...over,
})

const makeTrip = (route: RoutePoint[]): PlannedTrip => ({
  id: 42,
  slug: '42',
  title: 'Mullerthal Trail',
  description: '',
  startDate: '2026-08-08',
  startTime: '09:00',
  transport: 'foot',
  visibility: 'private',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 7, name: 'Owner', avatarUrl: null },
  route,
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
})

const renderRouteBuilder = (route: RoutePoint[], layout: 'stack' | 'mapFirst') =>
  render(<RouteBuilder trip={makeTrip(route)} layout={layout} />, {
    wrapper: createQueryWrapper().Wrapper,
  })

/** Первая точка правится, заполняется бронью и сохраняется вместе с маршрутом. */
const fillBooking = (
  getByTestId: ReturnType<typeof renderRouteBuilder>['getByTestId'],
  values: { address?: string; url?: string; price?: string; checkin?: string },
) => {
  if (values.address !== undefined) {
    fireEvent.changeText(getByTestId('route-builder-overnight-address'), values.address)
  }
  if (values.url !== undefined) {
    fireEvent.changeText(getByTestId('route-builder-overnight-url'), values.url)
  }
  if (values.price !== undefined) {
    fireEvent.changeText(getByTestId('route-builder-overnight-price'), values.price)
  }
  if (values.checkin !== undefined) {
    fireEvent.changeText(getByTestId('route-builder-overnight-checkin'), values.checkin)
  }
}

describe.each(['stack', 'mapFirst'] as const)('RouteBuilder: бронь ночёвки (%s)', (layout) => {
  beforeEach(() => {
    mockRouteMutate.mockReset()
  })

  it('показывает поля брони только у типа «ночёвка»', () => {
    const { getByTestId, queryByTestId } = renderRouteBuilder(
      [makePoint(), makePoint({ id: 'p1', name: 'Точка 2' })],
      layout,
    )

    fireEvent.press(getByTestId('route-builder-edit-0'))
    // Точка своя, не ночёвка — блока брони в форме нет.
    expect(queryByTestId('route-builder-overnight-fields')).toBeNull()

    fireEvent.press(getByTestId('route-builder-edit-type-overnight'))
    expect(getByTestId('route-builder-overnight-fields')).toBeTruthy()

    // Возврат к прежнему типу снова прячет блок.
    fireEvent.press(getByTestId('route-builder-edit-type-rest'))
    expect(queryByTestId('route-builder-overnight-fields')).toBeNull()
  })

  it('сохраняет бронь нормализованной и отдаёт её в PUT маршрута', () => {
    const { getByTestId } = renderRouteBuilder(
      [makePoint(), makePoint({ id: 'p1', name: 'Точка 2' })],
      layout,
    )

    fireEvent.press(getByTestId('route-builder-edit-0'))
    fireEvent.press(getByTestId('route-builder-edit-type-overnight'))
    fillBooking(getByTestId, {
      address: 'Rue de la Gare 1, Echternach',
      // Голый домен и запятая в цене — то, что реально набирают руками.
      url: 'booking.com/hotel/lu/echternach.html',
      price: '84,50',
      checkin: '15.00',
    })
    fireEvent.press(getByTestId('route-builder-edit-save'))
    fireEvent.press(getByTestId('route-builder-save'))

    expect(mockRouteMutate).toHaveBeenCalledTimes(1)
    const saved = mockRouteMutate.mock.calls[0][0].route as RoutePoint[]
    expect(saved[0]).toMatchObject({
      type: 'overnight',
      booking: {
        address: 'Rue de la Gare 1, Echternach',
        url: 'https://booking.com/hotel/lu/echternach.html',
        price: 84.5,
        checkinTime: '15:00',
      },
    })
    // Regression control: соседняя точка другого типа брони не получила.
    expect(saved[1].booking ?? null).toBeNull()
  })

  it.each([
    ['время заезда', { checkin: '14-00' }, 'tripsStatic:plan.overnight.errors.checkin'],
    ['цену', { price: '42 евро' }, 'tripsStatic:plan.overnight.errors.price'],
    ['ссылку', { url: 'javascript:alert(1)' }, 'tripsStatic:plan.overnight.errors.url'],
  ] as const)('не закрывает форму и показывает ошибку на негодную %s', (_case, values, key) => {
    const { getByTestId, getByText } = renderRouteBuilder([makePoint()], layout)

    fireEvent.press(getByTestId('route-builder-edit-0'))
    fireEvent.press(getByTestId('route-builder-edit-type-overnight'))
    fillBooking(getByTestId, values)
    fireEvent.press(getByTestId('route-builder-edit-save'))

    // Форма осталась открытой, введённое не потеряно, а причина названа.
    expect(getByTestId('route-builder-edit-form')).toBeTruthy()
    expect(getByTestId('route-builder-overnight-fields')).toBeTruthy()
    expect(getByText(i18nT(key))).toBeTruthy()
    expect(mockRouteMutate).not.toHaveBeenCalled()
  })

  it('считает правку одной только брони несохранённой и отправляет её', () => {
    // Кнопка «Сохранить маршрут» существует, только пока подпись черновика
    // разошлась с сохранённой (`routeBuilderCta.visible`), а `handleSave` при
    // совпадении подписей уходит в ранний возврат. Пока бронь не входила в
    // `routeSignature`, заполнение её полей — без единой правки имени, типа или
    // координат — не давало ни кнопки, ни PUT: введённое пропадало молча.
    const { getByTestId } = renderRouteBuilder(
      [
        makePoint({ type: 'overnight', name: 'Ночёвка 1' }),
        makePoint({ id: 'p1', name: 'Точка 2' }),
      ],
      layout,
    )

    fireEvent.press(getByTestId('route-builder-edit-0'))
    fillBooking(getByTestId, { url: 'booking.com/hotel/lu/echternach.html' })
    fireEvent.press(getByTestId('route-builder-edit-save'))
    fireEvent.press(getByTestId('route-builder-save'))

    expect(mockRouteMutate).toHaveBeenCalledTimes(1)
    const saved = mockRouteMutate.mock.calls[0][0].route as RoutePoint[]
    expect(saved[0]).toMatchObject({
      type: 'overnight',
      name: 'Ночёвка 1',
      booking: { url: 'https://booking.com/hotel/lu/echternach.html' },
    })
  })

  it('роняет бронь, когда точка перестала быть ночёвкой', () => {
    const { getByTestId } = renderRouteBuilder(
      [
        makePoint({
          type: 'overnight',
          name: 'Ночёвка 1',
          booking: {
            address: 'Rue de la Gare 1',
            url: 'https://booking.com/hotel/lu/x.html',
            price: 84.5,
            checkinTime: '15:00',
          },
        }),
      ],
      layout,
    )

    fireEvent.press(getByTestId('route-builder-edit-0'))
    // Форма подставила сохранённую бронь…
    expect(getByTestId('route-builder-overnight-address').props.value).toBe('Rue de la Gare 1')
    // …а смена типа обязана её снять: показать бронь у «отдыха» нечем.
    fireEvent.press(getByTestId('route-builder-edit-type-rest'))
    fireEvent.press(getByTestId('route-builder-edit-save'))
    fireEvent.press(getByTestId('route-builder-save'))

    const saved = mockRouteMutate.mock.calls[0][0].route as RoutePoint[]
    expect(saved[0].type).toBe('rest')
    expect(saved[0].booking).toBeNull()
  })

  it('показывает бронь в строке точки ссылкой, ценой и временем заезда', () => {
    const { getByTestId, queryByTestId } = renderRouteBuilder(
      [
        makePoint({
          type: 'overnight',
          name: 'Ночёвка 1',
          booking: {
            address: 'Rue de la Gare 1',
            url: 'https://www.booking.com/hotel/lu/x.html',
            price: 84.5,
            checkinTime: '15:00',
          },
        }),
        makePoint({ id: 'p1', name: 'Точка 2' }),
      ],
      layout,
    )

    const bookingRow = getByTestId('route-builder-point-booking-0')
    expect(bookingRow).toBeTruthy()
    // Ссылка — настоящий анкор на домен брони, а не кусок описания.
    const link = getByTestId('route-builder-point-booking-link-0')
    expect(link.props.children).toContain('booking.com')
    expect(link.props.accessibilityRole).toBe('link')

    // У точки другого типа блока брони в строке нет.
    expect(queryByTestId('route-builder-point-booking-1')).toBeNull()
  })
})
