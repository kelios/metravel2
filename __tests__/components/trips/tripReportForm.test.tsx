import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { fetchPlacesCatalog } from '@/api/places'
import type { PlannedTrip } from '@/api/plannedTrips'
import TripReportForm from '@/components/trips/planning/TripReportForm'
import type { PlacesCatalogPage } from '@/utils/placesCatalog'

const mockMutate = jest.fn()

jest.mock('@/api/places', () => ({
  fetchPlacesCatalog: jest.fn(),
}))

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  useSubmitTripReport: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}))

const mockedFetchPlacesCatalog = fetchPlacesCatalog as jest.MockedFunction<typeof fetchPlacesCatalog>

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
  status: 'completed',
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
      travelImageThumbUrl: '',
      urlTravel: '/travels/nesvizh',
      searchText: 'несвижский замок',
    },
  ],
  categoryFacets: [],
  countryFacets: [],
}

beforeEach(() => {
  ;(Platform as { OS: string }).OS = 'web'
  mockMutate.mockClear()
  mockedFetchPlacesCatalog.mockReset()
  mockedFetchPlacesCatalog.mockResolvedValue(placesPage)
})

describe('TripReportForm places selector', () => {
  it('uses searchable place selection instead of manual place IDs', async () => {
    const { findByTestId, getByTestId, queryByText } = render(
      <TripReportForm trip={makeTrip()} />,
    )

    expect(queryByText(/ID посещённых мест/i)).toBeNull()

    fireEvent.changeText(getByTestId('trip-report-place-search'), 'Несвиж')

    const option = await findByTestId('trip-report-place-option-42')
    expect(mockedFetchPlacesCatalog).toHaveBeenCalledWith(
      { page: 1, perPage: 8, q: 'Несвиж' },
      expect.any(AbortSignal),
    )

    fireEvent.press(option)
    expect(getByTestId('trip-report-selected-place-42')).toBeTruthy()

    fireEvent.changeText(
      getByTestId('trip-report-summary'),
      'Поездка прошла отлично, место посетили.',
    )
    fireEvent.press(getByTestId('trip-report-submit'))

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1))
    expect(mockMutate.mock.calls[0][0]).toMatchObject({
      tripId: 8001,
      summary: 'Поездка прошла отлично, место посетили.',
      visitedPlaceIds: [42],
    })
  })
})


describe('actual report-form search debounce (#2235)', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())
  const tick = (ms: number) => act(async () => { await jest.advanceTimersByTimeAsync(ms) })
  it('waits400ms after the third letter and clears existing options immediately without a request', async () => {
    const screen = render(<TripReportForm trip={makeTrip()} />)
    const input = screen.getByTestId('trip-report-place-search')
    for (const q of ['Н', 'Не', 'Нес']) { fireEvent.changeText(input, q); await tick(100) }
    await tick(299)
    expect(mockedFetchPlacesCatalog).not.toHaveBeenCalled()
    await tick(1)
    expect(mockedFetchPlacesCatalog).toHaveBeenCalledTimes(1)
    expect(mockedFetchPlacesCatalog.mock.calls[0][0]).toEqual({ page: 1, perPage: 8, q: 'Нес' })
    expect(screen.getByTestId('trip-report-place-option-42')).toBeTruthy()
    fireEvent.changeText(input, '')
    expect(screen.queryByTestId('trip-report-place-option-42')).toBeNull()
    await tick(1000)
    expect(mockedFetchPlacesCatalog).toHaveBeenCalledTimes(1)
    expect(mockMutate).not.toHaveBeenCalled()
    screen.unmount()
  })
  it('aborts an in-flight cleared query and ignores its late successful reply', async () => {
    let resolve!: (page: PlacesCatalogPage) => void
    mockedFetchPlacesCatalog.mockReturnValue(new Promise((res) => { resolve = res }))
    const screen = render(<TripReportForm trip={makeTrip()} />)
    const input = screen.getByTestId('trip-report-place-search')
    fireEvent.changeText(input, 'Несвиж')
    await tick(400)
    const signal = mockedFetchPlacesCatalog.mock.calls[0][1]!
    fireEvent.changeText(input, '')
    expect(signal.aborted).toBe(true)
    await act(async () => { resolve(placesPage); await Promise.resolve() })
    expect(screen.queryByTestId('trip-report-place-option-42')).toBeNull()
    expect(mockedFetchPlacesCatalog).toHaveBeenCalledTimes(1)
    screen.unmount()
  })
})
