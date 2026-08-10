import type { TripBikeType } from '@/api/plannedTrips'

const makeTripDto = (bikeType?: string | null) => ({
  id: 42,
  title: 'Rebuilt bike route',
  description: 'Server response',
  start_date: '2026-08-08T09:00:00Z',
  status: 'planned',
  transport_mode: 'bicycle',
  ...(bikeType === undefined ? {} : { bike_type: bikeType }),
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
    distance_km: 21.4,
    duration_min: 78,
    elevation_gain_m: 210,
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

const mockApiModules = (patch: jest.Mock) => {
  jest.resetModules()
  jest.doMock('@/api/client', () => ({
    apiClient: { patch },
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
}

describe('updatePlannedTripBikeType', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
    jest.dontMock('@/api/client')
    jest.dontMock('@/stores/authStore')
    jest.dontMock('@/utils/logger')
    jest.resetModules()
  })

  it.each<TripBikeType>(['regular', 'road', 'mountain'])(
    'sends one focused PATCH for %s and normalizes the rebuilt route',
    async (bikeType) => {
      delete process.env.EXPO_PUBLIC_TRIPS_MOCK
      const patch = jest.fn(async () => makeTripDto(bikeType))
      mockApiModules(patch)

      const { updatePlannedTripBikeType } = require('@/api/plannedTrips') as typeof import('@/api/plannedTrips')
      const trip = await updatePlannedTripBikeType({ tripId: 42, bikeType })

      expect(patch).toHaveBeenCalledTimes(1)
      expect(patch).toHaveBeenCalledWith('/trips/planned/42/', { bike_type: bikeType })
      expect(trip).toEqual(expect.objectContaining({
        id: 42,
        transport: 'bike',
        bikeType,
        routeGeometry: [
          [27.56, 53.9],
          [27.5, 53.85],
          [27.4, 53.8],
        ],
        routeSummary: expect.objectContaining({
          distanceKm: 21.4,
          durationMin: 78,
          provider: 'ors',
        }),
      }))
    },
  )

  // Дефолт здесь маскировал бы неприменённую миграцию: контрол молча
  // откатывался бы на «Обычный» вместо того, чтобы не показываться вовсе.
  it.each([
    ['missing', undefined],
    ['null', null],
    ['unknown', 'gravel'],
  ])('reports an unknown bike type as absent for a %s bike_type', async (_label, raw) => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
    const patch = jest.fn(async () => makeTripDto(raw as string | null | undefined))
    mockApiModules(patch)

    const { updatePlannedTripBikeType } = require('@/api/plannedTrips') as typeof import('@/api/plannedTrips')
    const trip = await updatePlannedTripBikeType({ tripId: 42, bikeType: 'road' })

    expect(trip.bikeType).toBeNull()
  })

  it('propagates a real API failure without falling back to mock data', async () => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
    const apiFailure = new Error('bike_type PATCH failed')
    const patch = jest.fn(async () => Promise.reject(apiFailure))
    mockApiModules(patch)

    const { updatePlannedTripBikeType } = require('@/api/plannedTrips') as typeof import('@/api/plannedTrips')

    await expect(updatePlannedTripBikeType({ tripId: 42, bikeType: 'mountain' })).rejects.toBe(apiFailure)
    expect(patch).toHaveBeenCalledTimes(1)
  })
})
