import type { RoutableTripTransport } from '@/api/plannedTrips'

const makeTripDto = (transportMode: string) => ({
  id: 42,
  title: 'Rebuilt route',
  description: 'Server response',
  start_date: '2026-08-08T09:00:00Z',
  status: 'planned',
  transport_mode: transportMode,
  owner: { id: 7, username: 'Owner', avatar: null },
  route: {
    points: [
      {
        id: 1,
        point_type: 'custom',
        order: 0,
        title: 'Start',
        description: '',
        lat: 53.9,
        lng: 27.56,
      },
      {
        id: 2,
        point_type: 'custom',
        order: 1,
        title: 'Finish',
        description: '',
        lat: 53.8,
        lng: 27.4,
      },
    ],
  },
  route_geometry: [
    [27.56, 53.9],
    [27.5, 53.85],
    [27.4, 53.8],
  ],
  route_summary: {
    distance_km: 18.5,
    duration_min: 52,
    elevation_gain_m: 140,
    stops_count: 1,
    provider: 'ors',
  },
  routing_state: {
    provider: 'ors',
    is_optimal: true,
    fallback_reason: null,
    warnings: [],
  },
  participants: [],
  is_public: false,
  max_participants: 4,
})

describe('updatePlannedTripTransport', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
    jest.dontMock('@/api/client')
    jest.dontMock('@/stores/authStore')
    jest.dontMock('@/utils/logger')
    jest.resetModules()
  })

  it.each<[RoutableTripTransport, string]>([
    ['car', 'car'],
    ['foot', 'walk'],
    ['bike', 'bicycle'],
  ])('sends one focused PATCH for %s and normalizes rebuilt route data', async (transport, apiValue) => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
    const apiClientMock = {
      patch: jest.fn(async () => makeTripDto(apiValue)),
    }

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

    const { updatePlannedTripTransport } = require('@/api/plannedTrips') as typeof import('@/api/plannedTrips')
    const trip = await updatePlannedTripTransport({ tripId: 42, transport })

    expect(apiClientMock.patch).toHaveBeenCalledTimes(1)
    expect(apiClientMock.patch).toHaveBeenCalledWith(
      '/trips/planned/42/',
      { transport_mode: apiValue },
    )
    expect(trip).toEqual(expect.objectContaining({
      id: 42,
      transport,
      routeGeometry: [
        [27.56, 53.9],
        [27.5, 53.85],
        [27.4, 53.8],
      ],
      routeSummary: expect.objectContaining({
        distanceKm: 18.5,
        durationMin: 52,
        provider: 'ors',
      }),
      routingState: {
        provider: 'ors',
        isOptimal: true,
        fallbackReason: null,
        warnings: [],
      },
    }))
  })

  it('propagates a real API failure without falling back to mock data', async () => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
    const apiFailure = new Error('transport PATCH failed')
    const apiClientMock = {
      patch: jest.fn(async () => Promise.reject(apiFailure)),
    }

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

    const { updatePlannedTripTransport } = require('@/api/plannedTrips') as typeof import('@/api/plannedTrips')

    await expect(
      updatePlannedTripTransport({ tripId: 42, transport: 'foot' }),
    ).rejects.toBe(apiFailure)
    expect(apiClientMock.patch).toHaveBeenCalledTimes(1)
  })

  it('updates fixture state only when trips mock mode is explicitly enabled', async () => {
    process.env.EXPO_PUBLIC_TRIPS_MOCK = 'true'
    jest.resetModules()
    jest.doMock('@/stores/authStore', () => ({
      useAuthStore: { getState: jest.fn(() => ({ userId: null, isAuthenticated: false })) },
    }))
    jest.doMock('@/utils/logger', () => ({
      devWarn: jest.fn(),
      devLog: jest.fn(),
      devError: jest.fn(),
    }))

    const { fetchMyPlannedTrips, updatePlannedTripTransport } = require('@/api/plannedTrips') as typeof import('@/api/plannedTrips')
    const [fixture] = await fetchMyPlannedTrips()
    const updated = await updatePlannedTripTransport({ tripId: fixture.id, transport: 'foot' })

    expect(updated.transport).toBe('foot')
    expect(updated.routeSummary?.durationMin).toBeGreaterThan(0)
  })
})
