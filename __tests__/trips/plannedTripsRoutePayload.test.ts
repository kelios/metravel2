import type { RoutePoint } from '@/api/plannedTrips'

const ROUTE_LENGTH = 25

const makeRoute = (): RoutePoint[] =>
  Array.from({ length: ROUTE_LENGTH }, (_, index) => ({
    id: `p${index}`,
    type: 'custom' as const,
    name: `Point ${index + 1}`,
    description: null,
    coordinates: [27.5 + index * 0.02, 53.9 + index * 0.03] as [number, number],
    placeId: null,
  }))

const makeTripDto = (pointCount: number) => ({
  id: 42,
  title: 'Long route',
  description: '',
  start_date: '2026-08-08T09:00:00Z',
  status: 'planned',
  transport_mode: 'car',
  owner: { id: 7, username: 'Owner', avatar: null },
  route: {
    points: Array.from({ length: pointCount }, (_, index) => ({
      id: index + 1,
      point_type: 'custom',
      order: index + 1,
      title: `Point ${index + 1}`,
      description: '',
      lat: 53.9 + index * 0.03,
      lng: 27.5 + index * 0.02,
    })),
  },
  participants: [],
  is_public: false,
  max_participants: 4,
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
  jest.doMock('@/utils/logger', () => ({
    devWarn: jest.fn(),
    devLog: jest.fn(),
    devError: jest.fn(),
  }))
  return require('@/api/plannedTrips') as typeof import('@/api/plannedTrips')
}

describe('updateTripRoute payload', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
    jest.dontMock('@/api/client')
    jest.dontMock('@/stores/authStore')
    jest.dontMock('@/utils/logger')
    jest.resetModules()
  })

  it('replaces the whole route with a single PUT and never truncates a long list', async () => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
    const apiClientMock = { put: jest.fn(async () => makeTripDto(ROUTE_LENGTH)) }
    const { updateTripRoute } = loadApi(apiClientMock)

    const trip = await updateTripRoute({ tripId: 42, route: makeRoute() })

    expect(apiClientMock.put).toHaveBeenCalledTimes(1)
    const [url, body] = apiClientMock.put.mock.calls[0] as [string, { points: unknown[] }]
    expect(url).toBe('/trips/planned/42/route/')
    expect(body.points).toHaveLength(ROUTE_LENGTH)
    expect(trip.route).toHaveLength(ROUTE_LENGTH)
    expect(trip.route.map((point) => point.name)).toEqual(
      Array.from({ length: ROUTE_LENGTH }, (_, index) => `Point ${index + 1}`),
    )
  })

  it('numbers order from one so a falsy zero cannot collide on the backend', async () => {
    // Развёрнутый бэкенд подменяет falsy `order: 0` своим номером, и первая точка
    // получала тот же order, что и вторая → `unique_together (trip, order)` и 400
    // на каждом маршруте длиннее одной точки.
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
    const apiClientMock = { put: jest.fn(async () => makeTripDto(ROUTE_LENGTH)) }
    const { updateTripRoute } = loadApi(apiClientMock)

    await updateTripRoute({ tripId: 42, route: makeRoute() })

    const [, body] = apiClientMock.put.mock.calls[0] as [
      string,
      { points: Array<{ order: number; title: string }> },
    ]
    expect(body.points.map((point) => point.order)).toEqual(
      Array.from({ length: ROUTE_LENGTH }, (_, index) => index + 1),
    )
    expect(body.points[0]).toEqual(expect.objectContaining({ order: 1, title: 'Point 1' }))
    expect(body.points[ROUTE_LENGTH - 1]).toEqual(
      expect.objectContaining({ order: ROUTE_LENGTH, title: `Point ${ROUTE_LENGTH}` }),
    )
  })

  it('#1843: поля брони уезжают плоскими ключами и только у ночёвки', async () => {
    // Проверяется провод, а не хелпер: PUT маршрута атомарный, поэтому ключ брони
    // у точки другого типа уронил бы сохранение всего маршрута (#1532), а пустое
    // текстовое поле обязано уходить пустой строкой — `address`/`booking_url` на
    // бэкенде объявлены `blank=True, default=''` без `null=True`.
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
    const apiClientMock = { put: jest.fn(async () => makeTripDto(3)) }
    const { updateTripRoute } = loadApi(apiClientMock)
    const base = makeRoute().slice(0, 3)

    await updateTripRoute({
      tripId: 42,
      route: [
        base[0],
        {
          ...base[1],
          type: 'overnight',
          booking: {
            address: 'Rue de la Gare 1',
            url: 'https://booking.com/hotel/lu/x.html',
            price: 84.5,
            checkinTime: '15:00',
          },
        },
        { ...base[2], type: 'overnight' },
      ],
    })

    const [, body] = apiClientMock.put.mock.calls[0] as [string, { points: Record<string, unknown>[] }]
    expect(body.points[1]).toEqual(
      expect.objectContaining({
        address: 'Rue de la Gare 1',
        booking_url: 'https://booking.com/hotel/lu/x.html',
        price: 84.5,
        checkin_time: '15:00',
      }),
    )
    // Ночёвка без брони обнуляет поля, иначе стереть введённое было бы нечем.
    expect(body.points[2]).toEqual(
      expect.objectContaining({ address: '', booking_url: '', price: null, checkin_time: null }),
    )
    // У точки другого типа ни одного ключа брони нет вовсе.
    expect(Object.keys(body.points[0])).toEqual(
      expect.not.arrayContaining(['address', 'booking_url', 'price', 'checkin_time']),
    )
  })
})
