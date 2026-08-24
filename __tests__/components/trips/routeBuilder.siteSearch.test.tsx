import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'

import { fetchPlacesCatalog } from '@/api/places'
import { fetchTravels } from '@/api/travelsApi'
import type { PlannedTrip } from '@/api/plannedTrips'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'
import { createQueryWrapper } from '../../helpers/testQueryClient'
import type { PlacesCatalogPage } from '@/utils/placesCatalog'
import type { Travel } from '@/types/types'

const mockMutate = jest.fn()
const mockTransportMutate = jest.fn()

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
    mutate: mockMutate,
    isPending: false,
  }),
  useUpdateTripTransport: () => ({
    mutate: mockTransportMutate,
    isPending: false,
  }),
  useUpdateTripBikeType: () => ({ mutate: jest.fn(), isPending: false }),
}))

jest.mock('@/components/ui/ImageCardMedia', () => {
  return function ImageCardMedia({ testID }: { testID?: string }) {
    const { View } = require('react-native')
    return <View testID={testID ?? 'image-card-media'} />
  }
})

// #1490: живое превью маршрута ходит в сеть за дорогой; здесь оно не предмет
// проверки, поэтому движок заглушён.
jest.mock('@/components/trips/planning/TripRoutePreviewEngine', () => {
  return function TripRoutePreviewEngine() {
    const { View } = require('react-native')
    return <View testID="trip-route-preview-engine" />
  }
})

jest.mock('@/components/trips/planning/TripPlanRouteMap', () => {
  return function TripPlanRouteMap({
    onAddPointFromMap,
    routeGeometry,
    routingState,
  }: {
    onAddPointFromMap?: (coords: { lat: number; lng: number }) => void
    routeGeometry?: Array<[number, number]> | null
    routingState?: { provider: string; isOptimal: boolean } | null
  }) {
    const { Pressable, Text } = require('react-native')
    return (
      <Pressable
        testID="trip-plan-route-map"
        onPress={() => onAddPointFromMap?.({ lat: 53.9006, lng: 27.559 })}
      >
        <Text>{`Карта маршрута ${routeGeometry?.length ?? 0} ${routingState?.provider ?? 'none'}`}</Text>
      </Pressable>
    )
  }
})

const mockedFetchPlacesCatalog = fetchPlacesCatalog as jest.MockedFunction<typeof fetchPlacesCatalog>
const mockedFetchTravels = fetchTravels as jest.MockedFunction<typeof fetchTravels>

const makeTrip = (): PlannedTrip => ({
  id: 8001,
  slug: '8001',
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
  isOwner: true,
  myRsvp: 'going',
  createdAt: '2026-07-01T10:00:00.000Z',
})

const placesPage: PlacesCatalogPage = {
  count: 1,
  places: [
    {
      id: '42',
      travelId: null,
      title: 'Несвижский замок',
      category: 'Замок',
      categoryId: 7,
      country: 'Беларусь',
      countryCode: 'BY',
      latNumber: 53.2225,
      lngNumber: 26.6906,
      coord: '53.2225,26.6906',
      lat: '53.2225',
      lng: '26.6906',
      address: 'Несвиж, Беларусь',
      categoryName: 'Замок',
      travelImageThumbUrl: '/media/nesvizh.jpg',
      urlTravel: '/travels/nesvizh',
      searchText: 'несвижский замок',
    },
  ],
  categoryFacets: [],
  countryFacets: [],
}

const travelsPage: { data: Travel[]; total: number } = {
  total: 1,
  data: [
    {
      id: 77,
      slug: 'mir-nesvizh',
      name: 'Маршрут Мир и Несвиж',
      travel_image_thumb_url: '/media/mir.jpg',
      travel_image_thumb_small_url: '/media/mir-small.jpg',
      url: '/travel/77',
      youtube_link: '',
      userName: 'Julia',
      description: 'Готовый маршрут по замкам.',
      recommendation: '',
      plus: '',
      minus: '',
      cityName: '',
      countryName: 'Беларусь',
      countUnicIpView: '0',
      gallery: [],
      travelAddress: [{ id: 1, name: 'Мирский замок', lat: 53.4511, lng: 26.4731 }],
      userIds: '',
      year: '2026',
      monthName: 'июль',
      number_days: 1,
      companions: [],
      countryCode: 'BY',
    },
  ],
}

beforeEach(() => {
  mockMutate.mockClear()
  mockTransportMutate.mockClear()
  mockedFetchPlacesCatalog.mockReset()
  mockedFetchTravels.mockReset()
  mockedFetchPlacesCatalog.mockResolvedValue(placesPage)
  mockedFetchTravels.mockResolvedValue(travelsPage)
})


// #1491: шаг «Точки маршрута» рендерит общий AddressSearch с /map, а он ходит за
// адресами через React Query — конструктору нужен клиент, как и в приложении.
const renderRouteBuilder = (element: React.ReactElement) =>
  render(element, { wrapper: createQueryWrapper().Wrapper })

describe('RouteBuilder site search', () => {
  it('adds a site place from search without manual coordinates', async () => {
    const { findByTestId, getByTestId, queryByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    expect(queryByTestId('route-builder-name')).toBeNull()

    fireEvent.changeText(getByTestId('route-builder-site-search'), 'Несвиж')

    const option = await findByTestId('route-builder-site-option-place-42')
    expect(mockedFetchPlacesCatalog).toHaveBeenCalledWith(
      { page: 1, perPage: 6, q: 'Несвиж' },
      expect.any(AbortSignal),
    )
    expect(mockedFetchTravels).toHaveBeenCalledWith(
      0,
      6,
      'Несвиж',
      {},
      { signal: expect.any(AbortSignal) },
    )

    fireEvent.press(option)
    fireEvent.press(getByTestId('route-builder-save'))

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1))
    expect(mockMutate.mock.calls[0][0].route[0]).toMatchObject({
      type: 'place',
      name: 'Несвижский замок',
      coordinates: [26.6906, 53.2225],
      placeId: 42,
    })
  })

  it('adds a travel from search as a route point', async () => {
    const { findByTestId, getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    fireEvent.changeText(getByTestId('route-builder-site-search'), 'Маршрут')

    const option = await findByTestId('route-builder-site-option-travel-77')
    fireEvent.press(option)
    fireEvent.press(getByTestId('route-builder-save'))

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1))
    expect(mockMutate.mock.calls[0][0].route[0]).toMatchObject({
      type: 'place',
      name: 'Маршрут Мир и Несвиж',
      coordinates: [26.4731, 53.4511],
      placeId: 77,
    })
  })

  it('edits an existing custom route point before saving', async () => {
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    fireEvent.press(getByTestId('route-builder-type-custom'))
    fireEvent.changeText(getByTestId('route-builder-name'), 'Старая точка')
    fireEvent.changeText(getByTestId('route-builder-lat'), '53.9')
    fireEvent.changeText(getByTestId('route-builder-lng'), '27.56')
    fireEvent.changeText(getByTestId('route-builder-description'), 'old')
    fireEvent.press(getByTestId('route-builder-add'))

    fireEvent.press(getByTestId('route-builder-edit-0'))
    fireEvent.changeText(getByTestId('route-builder-edit-name'), 'Новая точка')
    fireEvent.changeText(getByTestId('route-builder-edit-description'), 'https://example.com/info')
    fireEvent.press(getByTestId('route-builder-edit-save'))
    fireEvent.press(getByTestId('route-builder-save'))

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1))
    expect(mockMutate.mock.calls[0][0].route[0]).toMatchObject({
      type: 'custom',
      name: 'Новая точка',
      description: 'https://example.com/info',
      coordinates: [27.56, 53.9],
      placeId: null,
    })
  })

  it('adds a custom point from the route map and opens it for editing', async () => {
    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    fireEvent.press(getByTestId('trip-plan-route-map'))
    fireEvent.changeText(getByTestId('route-builder-edit-name'), 'Точка с карты')
    fireEvent.press(getByTestId('route-builder-edit-save'))
    fireEvent.press(getByTestId('route-builder-save'))

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1))
    expect(mockMutate.mock.calls[0][0].route[0]).toMatchObject({
      type: 'custom',
      name: 'Точка с карты',
      coordinates: [27.559, 53.9006],
      placeId: null,
    })
  })

  it('uses saved routed geometry and shows direct fallback as approximate', () => {
    const trip = makeTrip()
    trip.route = [
      { id: 'a', type: 'custom', name: 'A', description: null, coordinates: [27.56, 53.9], placeId: null },
      { id: 'b', type: 'custom', name: 'B', description: null, coordinates: [26.69, 53.22], placeId: null },
    ]
    trip.routeGeometry = [
      [27.56, 53.9],
      [27.1, 53.55],
      [26.69, 53.22],
    ]
    trip.routeSummary = {
      distanceKm: 123.4,
      durationMin: 321,
      elevationGainM: 0,
      stopsCount: 2,
      provider: 'direct',
      updatedAt: '2026-07-09T12:00:00Z',
    }
    trip.routingState = {
      provider: 'direct',
      isOptimal: false,
      fallbackReason: 'ors_http_404',
      warnings: [],
    }

    const { getByTestId, getByText } = renderRouteBuilder(<RouteBuilder trip={trip} />)

    expect(getByText(/Карта маршрута 3 direct/)).toBeTruthy()
    expect(getByTestId('route-summary-approximate')).toBeTruthy()
    expect(getByText('Приблизительный маршрут')).toBeTruthy()
  })
})

// #1532: тип `place` в маршруте существует только вместе с привязкой к месту
// или путешествию MeTravel. Форма редактирования раньше давала переключить на
// него любую точку, и весь `PUT /trips/planned/{id}/route/` уходил с
// `point_type: 'travel', place_id: null` — бэкенд отклонял его целиком, теряя
// заодно все здоровые точки маршрута.
describe('RouteBuilder point type binding', () => {
  it('hides the place type when editing a point without a MeTravel binding', () => {
    const { getByTestId, queryByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    fireEvent.press(getByTestId('route-builder-type-custom'))
    fireEvent.changeText(getByTestId('route-builder-name'), 'Ручная точка')
    fireEvent.changeText(getByTestId('route-builder-lat'), '53.9')
    fireEvent.changeText(getByTestId('route-builder-lng'), '27.56')
    fireEvent.press(getByTestId('route-builder-add'))

    fireEvent.press(getByTestId('route-builder-edit-0'))

    expect(queryByTestId('route-builder-edit-type-place')).toBeNull()
    expect(getByTestId('route-builder-edit-type-custom')).toBeTruthy()
    expect(getByTestId('route-builder-edit-type-rest')).toBeTruthy()
    expect(getByTestId('route-builder-edit-type-overnight')).toBeTruthy()
    // Форма добавления к типу «Место» доступ не теряет: там он выбирается
    // вместе с самим местом через поиск по сайту.
    expect(getByTestId('route-builder-type-place')).toBeTruthy()
  })

  it('hides the place type for a point added from the map', () => {
    const { getByTestId, queryByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    fireEvent.press(getByTestId('trip-plan-route-map'))

    expect(getByTestId('route-builder-edit-form')).toBeTruthy()
    expect(queryByTestId('route-builder-edit-type-place')).toBeNull()
  })

  it('keeps the place type and the binding when editing a linked point', async () => {
    const trip = makeTrip()
    trip.route = [
      {
        id: 'p1',
        type: 'place',
        name: 'Несвижский замок',
        description: null,
        coordinates: [26.6906, 53.2225],
        placeId: 42,
      },
    ]

    const { getByTestId } = renderRouteBuilder(<RouteBuilder trip={trip} />)

    fireEvent.press(getByTestId('route-builder-edit-0'))
    expect(getByTestId('route-builder-edit-type-place')).toBeTruthy()

    fireEvent.changeText(getByTestId('route-builder-edit-name'), 'Несвиж, замок')
    fireEvent.press(getByTestId('route-builder-edit-save'))
    fireEvent.press(getByTestId('route-builder-save'))

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1))
    expect(mockMutate.mock.calls[0][0].route[0]).toMatchObject({
      type: 'place',
      name: 'Несвиж, замок',
      placeId: 42,
    })
  })

  it('normalizes a place point without a binding to custom on save', async () => {
    const trip = makeTrip()
    trip.route = [
      {
        id: 'p1',
        type: 'place',
        name: 'Парк Горького',
        description: null,
        coordinates: [27.5774, 53.9028],
        placeId: null,
      },
    ]

    const { getByTestId, queryByTestId } = renderRouteBuilder(<RouteBuilder trip={trip} />)

    fireEvent.press(getByTestId('route-builder-edit-0'))
    expect(queryByTestId('route-builder-edit-type-place')).toBeNull()

    fireEvent.press(getByTestId('route-builder-edit-save'))
    fireEvent.press(getByTestId('route-builder-save'))

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1))
    expect(mockMutate.mock.calls[0][0].route[0]).toMatchObject({
      type: 'custom',
      name: 'Парк Горького',
      placeId: null,
    })
  })
})
