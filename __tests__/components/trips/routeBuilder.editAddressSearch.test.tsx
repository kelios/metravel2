// #1782: в форме точки маршрута поездки координаты приходилось знать наизусть —
// тестировщик видел только два числовых поля «широта»/«долгота». Поиск места по
// названию переиспользован из /map (`AddressSearch`, канонический
// `api/external/nominatim`), а тест держит именно связку «выбрал результат →
// координаты подставились», ручной ввод как запасной путь и то, что выбор
// адреса при добавлении больше не выбрасывает уже введённое.
import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import type { PlannedTrip } from '@/api/plannedTrips'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'
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

// Живой Nominatim здесь не проверяется: тест держит раскладку выбранного
// результата в поля формы, а не сам поиск.
jest.mock('@/components/MapPage/AddressSearch', () => {
  return function AddressSearch({
    onAddressSelect,
  }: {
    onAddressSelect: (address: string, coords: { lat: number; lng: number }) => void
  }) {
    const { Pressable } = require('react-native')
    return (
      <Pressable
        testID="route-builder-address-pick"
        onPress={() =>
          onAddressSelect('Острава, Моравскосилезский край, Чехия', {
            lat: 49.8209,
            lng: 18.2625,
          })
        }
      />
    )
  }
})

const makePoint = (index: number) => ({
  id: `p${index}`,
  type: 'custom' as const,
  name: `Точка ${index + 1}`,
  description: null,
  coordinates: [27.5 + index * 0.02, 53.9 + index * 0.03] as [number, number],
  placeId: null,
})

const makeTrip = (overrides: Partial<PlannedTrip> = {}): PlannedTrip => ({
  id: 42,
  slug: '42',
  title: 'Маршрут',
  description: '',
  startDate: '2026-08-08',
  startTime: '09:00',
  transport: 'car',
  visibility: 'private',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 7, name: 'Owner', avatarUrl: null },
  route: [makePoint(0), makePoint(1)],
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

const renderRouteBuilder = (element: React.ReactElement) =>
  render(element, { wrapper: createQueryWrapper().Wrapper })

describe.each(['stack', 'mapFirst'] as const)('RouteBuilder: поиск места (%s)', (layout) => {
  beforeEach(() => {
    mockRouteMutate.mockReset()
  })

  it('подставляет координаты выбранного места в поля правки точки', () => {
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} layout={layout} />)

    fireEvent.press(getByTestId('route-builder-edit-0'))
    fireEvent.press(getByTestId('route-builder-address-pick'))

    expect(getByTestId('route-builder-edit-lat').props.value).toBe('49.8209')
    expect(getByTestId('route-builder-edit-lng').props.value).toBe('18.2625')
    // Название точки принадлежит пользователю и адресом не затирается.
    expect(getByTestId('route-builder-edit-name').props.value).toBe('Точка 1')

    fireEvent.press(getByTestId('route-builder-edit-save'))
    fireEvent.press(getByTestId('route-builder-save'))

    expect(mockRouteMutate).toHaveBeenCalledTimes(1)
    expect(mockRouteMutate.mock.calls[0][0].route[0]).toMatchObject({
      name: 'Точка 1',
      coordinates: [18.2625, 49.8209],
    })
  })

  it('оставляет ручной ввод координат рабочим запасным путём', () => {
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} layout={layout} />)

    fireEvent.press(getByTestId('route-builder-edit-0'))
    fireEvent.changeText(getByTestId('route-builder-edit-lat'), '50.5')
    fireEvent.changeText(getByTestId('route-builder-edit-lng'), '30.25')
    fireEvent.press(getByTestId('route-builder-edit-save'))
    fireEvent.press(getByTestId('route-builder-save'))

    expect(mockRouteMutate.mock.calls[0][0].route[0]).toMatchObject({
      coordinates: [30.25, 50.5],
    })
  })

  it('не отдаёт бэкенду тип place без привязки к месту и не берёт скрытые поля', () => {
    const { getByTestId, queryByTestId } = renderRouteBuilder(
      <RouteBuilder trip={makeTrip({ route: [] })} layout={layout} />,
    )

    fireEvent.press(getByTestId('route-builder-add-action'))
    fireEvent.press(getByTestId('route-builder-type-custom'))
    fireEvent.changeText(getByTestId('route-builder-name'), 'Черновик прошлой попытки')
    // «Место» — состояние формы по умолчанию: она показывает только поиск по
    // MeTravel, набранное название с экрана уходит и в точку попасть не должно.
    fireEvent.press(getByTestId('route-builder-type-place'))
    expect(queryByTestId('route-builder-name')).toBeNull()

    fireEvent.press(getByTestId('route-builder-address-pick'))
    expect(getByTestId('route-builder-name').props.value).toBe('Острава')
    expect(getByTestId('route-builder-lat').props.value).toBe('49.8209')
    expect(getByTestId('route-builder-lng').props.value).toBe('18.2625')
    expect(queryByTestId('route-builder-site-search')).toBeNull()
    expect(queryByTestId('route-builder-save')).toBeNull()

    // Выбор только заполняет форму: до добавления можно уточнить имя.
    fireEvent.changeText(getByTestId('route-builder-name'), 'Встреча в Остраве')
    fireEvent.press(getByTestId('route-builder-add'))
    fireEvent.press(getByTestId('route-builder-save'))

    expect(mockRouteMutate.mock.calls[0][0].route[0]).toMatchObject({
      // #1532: `place` без `placeId` бэкенд отклоняет вместе со всем маршрутом.
      type: 'custom',
      placeId: null,
      name: 'Встреча в Остраве',
      coordinates: [18.2625, 49.8209],
    })
  })

  it('сохраняет выбранный тип и введённое название при добавлении по поиску', () => {
    const { getByTestId } = renderRouteBuilder(
      <RouteBuilder trip={makeTrip({ route: [] })} layout={layout} />,
    )

    fireEvent.press(getByTestId('route-builder-add-action'))
    fireEvent.press(getByTestId('route-builder-type-overnight'))
    fireEvent.changeText(getByTestId('route-builder-name'), 'Ночёвка в Остраве')
    fireEvent.changeText(getByTestId('route-builder-description'), 'Встречаемся у вокзала')
    fireEvent.press(getByTestId('route-builder-address-pick'))
    fireEvent.press(getByTestId('route-builder-add'))
    fireEvent.press(getByTestId('route-builder-save'))

    expect(mockRouteMutate.mock.calls[0][0].route[0]).toMatchObject({
      type: 'overnight',
      name: 'Ночёвка в Остраве',
      description: 'Встречаемся у вокзала',
      coordinates: [18.2625, 49.8209],
    })
  })

  it('заполняет пустое название в правке и разрешает изменить его до сохранения', () => {
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} layout={layout} />)

    fireEvent.press(getByTestId('route-builder-edit-0'))
    fireEvent.changeText(getByTestId('route-builder-edit-name'), '')
    fireEvent.press(getByTestId('route-builder-address-pick'))
    expect(getByTestId('route-builder-edit-name').props.value).toBe('Острава')
    fireEvent.changeText(getByTestId('route-builder-edit-name'), 'Остановка в Остраве')
    fireEvent.press(getByTestId('route-builder-edit-save'))
    fireEvent.press(getByTestId('route-builder-save'))

    expect(mockRouteMutate.mock.calls[0][0].route[0]).toMatchObject({
      name: 'Остановка в Остраве',
      coordinates: [18.2625, 49.8209],
    })
  })

  it('отмена после выбора адреса оставляет маршрут прежним', () => {
    const { getByTestId, queryByTestId } = renderRouteBuilder(
      <RouteBuilder trip={makeTrip()} layout={layout} />,
    )

    fireEvent.press(getByTestId('route-builder-add-action'))
    fireEvent.press(getByTestId('route-builder-address-pick'))
    fireEvent.press(getByTestId('route-builder-add-cancel'))

    expect(queryByTestId('route-builder-add-form')).toBeNull()
    expect(queryByTestId('route-builder-save')).toBeNull()
    expect(mockRouteMutate).not.toHaveBeenCalled()
  })

  it('позволяет добавить точку ручным вводом без результата поиска', () => {
    const { getByTestId } = renderRouteBuilder(
      <RouteBuilder trip={makeTrip({ route: [] })} layout={layout} />,
    )

    fireEvent.press(getByTestId('route-builder-add-action'))
    fireEvent.press(getByTestId('route-builder-type-custom'))
    fireEvent.changeText(getByTestId('route-builder-name'), 'Ручная точка')
    fireEvent.changeText(getByTestId('route-builder-lat'), '49.8209')
    fireEvent.changeText(getByTestId('route-builder-lng'), '18.2625')
    fireEvent.press(getByTestId('route-builder-add'))
    fireEvent.press(getByTestId('route-builder-save'))

    expect(mockRouteMutate.mock.calls[0][0].route[0]).toMatchObject({
      type: 'custom',
      name: 'Ручная точка',
      coordinates: [18.2625, 49.8209],
    })
  })
})
