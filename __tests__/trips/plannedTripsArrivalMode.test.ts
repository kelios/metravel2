// #2055: способ прибытия к точке доезжает из ответа API в домен и обратно в PUT.
// Без ключа в полном PUT бэкенд пишет `''`, и сохранение из конструктора
// молча стирало бы поезд, перелёты и автобусы поездки.
import type { RoutePoint } from '@/api/plannedTrips'
import { mapTrip, type PlannedTripDto } from '@/api/plannedTripsNormalizers'
import { arrivalModeFromBe, arrivalModePayload } from '@/utils/routePointArrivalMode'

const dto = (points: NonNullable<PlannedTripDto['route']>['points']): PlannedTripDto => ({
  id: 47,
  title: 'Mullerthal Trail',
  start_date: '2026-09-25',
  status: 'planned',
  transport_mode: 'walk',
  owner: { id: 7, username: 'Owner', avatar: null },
  route: { points },
  participants: [],
  is_public: false,
  max_participants: 1,
})

const point = (index: number, extra: Partial<RoutePoint> = {}): RoutePoint => ({
  id: `p${index}`,
  type: 'custom',
  name: `Point ${index + 1}`,
  description: null,
  coordinates: [6.42 + index * 0.01, 49.81 - index * 0.01],
  placeId: null,
  ...extra,
})

const loadApi = (apiClientMock: { put: jest.Mock }) => {
  jest.resetModules()
  jest.doMock('@/api/client', () => ({
    apiClient: apiClientMock,
    ApiError: class ApiError extends Error {
      status: number
      constructor(status: number, message: string) {
        super(message)
        this.status = status
      }
    },
  }))
  jest.doMock('@/stores/authStore', () => ({
    useAuthStore: { getState: jest.fn(() => ({ userId: '7', isAuthenticated: true })) },
  }))
  jest.doMock('@/utils/logger', () => ({ devWarn: jest.fn(), devLog: jest.fn(), devError: jest.fn() }))
  return require('@/api/plannedTrips') as typeof import('@/api/plannedTrips')
}

describe('arrival_mode', () => {
  it('mapTrip читает известные способы, а пустую строку и мусор — как «вся поездка»', () => {
    const trip = mapTrip(
      dto([
        { id: 1, point_type: 'custom', title: 'Краков', lat: 50.07, lng: 19.95, arrival_mode: '' },
        { id: 2, point_type: 'custom', title: 'Мюнхен', lat: 48.14, lng: 11.56, arrival_mode: 'train' },
        { id: 3, point_type: 'custom', title: 'Findel', lat: 49.63, lng: 6.2, arrival_mode: 'flight' },
        { id: 4, point_type: 'custom', title: 'Мусор', lat: 49.62, lng: 6.13, arrival_mode: 'rocket' },
        { id: 5, point_type: 'custom', title: 'Старый бэкенд', lat: 49.61, lng: 6.13 },
      ]),
    )

    expect(trip.route.map((p) => p.arrivalMode)).toEqual([null, 'train', 'flight', null, null])
  })

  it('payload: у первой точки всегда пустая строка, незнакомое значение не уходит на бэкенд', () => {
    expect(arrivalModePayload({ arrivalMode: 'flight' }, 0)).toEqual({ arrival_mode: '' })
    expect(arrivalModePayload({ arrivalMode: 'bus' }, 3)).toEqual({ arrival_mode: 'bus' })
    expect(arrivalModePayload({ arrivalMode: null }, 3)).toEqual({ arrival_mode: '' })
    expect(arrivalModePayload({}, 3)).toEqual({ arrival_mode: '' })
    expect(arrivalModePayload({ arrivalMode: 'rocket' as never }, 3)).toEqual({ arrival_mode: '' })
    expect(arrivalModeFromBe(undefined)).toBeNull()
  })

  it('updateTripRoute отправляет arrival_mode на каждой точке — сохранение не стирает переезды', async () => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
    const apiClientMock = {
      put: jest.fn(async () =>
        dto([{ id: 1, point_type: 'custom', title: 'Point 1', lat: 49.81, lng: 6.42 }]),
      ),
    }
    const { updateTripRoute } = loadApi(apiClientMock)

    await updateTripRoute({
      tripId: 47,
      route: [
        point(0, { arrivalMode: 'train' }),
        point(1, { arrivalMode: 'flight' }),
        point(2),
        point(3, { arrivalMode: 'bus' }),
      ],
    })

    const [, body] = apiClientMock.put.mock.calls[0] as [
      string,
      { points: Array<{ arrival_mode: string }> },
    ]
    expect(body.points.map((p) => p.arrival_mode)).toEqual(['', 'flight', '', 'bus'])
  })
})

describe('ROUTE_POINT_PUT_KEYS', () => {
  it('каждый названный ключ PUT реально уходит в тело для полностью заполненной ночёвки', async () => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
    const apiClientMock = {
      put: jest.fn(async () =>
        dto([{ id: 1, point_type: 'custom', title: 'Point 1', lat: 49.81, lng: 6.42 }]),
      ),
    }
    const api = loadApi(apiClientMock)
    const { ROUTE_POINT_PUT_KEYS } = require('@/api/plannedTripsRequests') as typeof import('@/api/plannedTripsRequests')

    await api.updateTripRoute({
      tripId: 47,
      route: [
        point(0),
        point(1, {
          type: 'overnight',
          description: 'Booking',
          booking: { address: 'Rue 1', url: 'https://booking.com/x', price: 90, checkinTime: '15:00' },
          dayNumber: 2,
          arrivalMode: 'bus',
        }),
      ],
    })

    const [, body] = apiClientMock.put.mock.calls[0] as [string, { points: Array<Record<string, unknown>> }]
    const sentKeys = Object.keys(body.points[1])
    const declared = Object.values(ROUTE_POINT_PUT_KEYS).flat()
    expect(declared.length).toBeGreaterThan(0)
    expect(sentKeys).toEqual(expect.arrayContaining(declared))
  })
})
