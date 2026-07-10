import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'

import { fetchPlacesCatalog } from '@/api/places'
import { fetchTravels } from '@/api/travelsApi'
import type { PlannedTrip } from '@/api/plannedTrips'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'
import type { PlacesCatalogPage } from '@/utils/placesCatalog'
import type { Travel } from '@/types/types'

const mockMutate = jest.fn()

jest.mock('@/api/places', () => ({
  fetchPlacesCatalog: jest.fn(),
}))

jest.mock('@/api/travelsApi', () => ({
  fetchTravels: jest.fn(),
}))

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  useRouteTemplates: () => ({ data: [] }),
  useUpdateTripRoute: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}))

jest.mock('@/components/ui/ImageCardMedia', () => {
  return function ImageCardMedia({ testID }: { testID?: string }) {
    const { View } = require('react-native')
    return <View testID={testID ?? 'image-card-media'} />
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
  mockedFetchPlacesCatalog.mockReset()
  mockedFetchTravels.mockReset()
  mockedFetchPlacesCatalog.mockResolvedValue(placesPage)
  mockedFetchTravels.mockResolvedValue(travelsPage)
})

describe('RouteBuilder site search', () => {
  it('adds a site place from search without manual coordinates', async () => {
    const { findByTestId, getByTestId, queryByTestId } = render(<RouteBuilder trip={makeTrip()} />)

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
    const { findByTestId, getByTestId } = render(<RouteBuilder trip={makeTrip()} />)

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
    const { getByTestId } = render(<RouteBuilder trip={makeTrip()} />)

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
    const { getByTestId } = render(<RouteBuilder trip={makeTrip()} />)

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

    const { getByTestId, getByText } = render(<RouteBuilder trip={trip} />)

    expect(getByText(/Карта маршрута 3 direct/)).toBeTruthy()
    expect(getByTestId('route-summary-approximate')).toBeTruthy()
    expect(getByText('Приблизительный маршрут')).toBeTruthy()
  })
})
