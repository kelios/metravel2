// __tests__/trips/plannedTripsAdapter.test.ts
// Unit-тесты адаптера plannedTrips с мок-слоем (Sprint 13 / FE-trip-tests #406).
// Используем EXPO_PUBLIC_TRIPS_MOCK=true чтобы обойти сеть и authStore.

// Must set env BEFORE any module imports — isolateModules guarantees fresh module registry.
// Top-level delete ensures the real module file sees the flag even after jest.resetModules.

jest.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(() => ({ userId: null, isAuthenticated: false })),
  },
}))

jest.mock('@/utils/logger', () => ({
  devWarn: jest.fn(),
  devLog: jest.fn(),
  devError: jest.fn(),
}))

// estimateRouteSummary relies on haversineKm — keep real implementation.

import type {
  CreateTripInput,
  PlannedTrip,
  RoutePoint,
  RsvpInput,
  SubmitReportInput,
  TripTransport,
} from '@/api/plannedTrips'

// ── helpers ──────────────────────────────────────────────────────────────────

const pt = (
  id: string,
  name: string,
  coordinates: [number, number] | null,
): RoutePoint => ({
  id,
  type: 'place',
  name,
  description: null,
  coordinates,
  placeId: null,
})

// ── estimateRouteSummary ──────────────────────────────────────────────────────

describe('estimateRouteSummary', () => {
  let estimateRouteSummary: (route: RoutePoint[], transport: TripTransport) => ReturnType<typeof import('@/api/plannedTrips').estimateRouteSummary>

  beforeAll(() => {
    // Import after mocks are registered.
    estimateRouteSummary = require('@/api/plannedTrips').estimateRouteSummary
  })

  it('returns zeros for empty route', () => {
    const result = estimateRouteSummary([], 'car')
    expect(result.distanceKm).toBe(0)
    expect(result.durationMin).toBe(0)
    expect(result.stopsCount).toBe(0)
  })

  it('returns zeros when all points lack coordinates', () => {
    const route = [pt('a', 'A', null), pt('b', 'B', null)]
    const result = estimateRouteSummary(route, 'car')
    expect(result.distanceKm).toBe(0)
    expect(result.durationMin).toBe(0)
    expect(result.stopsCount).toBe(1) // stopsCount = route.length - 1
  })

  it('computes positive distanceKm for 2-point route with real coords', () => {
    // Минск → Несвиж (~115 км по прямой)
    const route = [
      pt('start', 'Минск', [27.5615, 53.9023]),
      pt('end', 'Несвижский замок', [26.6906, 53.2225]),
    ]
    const result = estimateRouteSummary(route, 'car')
    expect(result.distanceKm).toBeGreaterThan(50)
    expect(result.distanceKm).toBeLessThan(200)
    expect(result.durationMin).toBeGreaterThan(0)
    expect(result.stopsCount).toBe(1)
    expect(result.elevationGainM).toBeGreaterThanOrEqual(0)
  })

  it('durationMin scales with transport speed', () => {
    const route = [
      pt('a', 'A', [27.5615, 53.9023]),
      pt('b', 'B', [26.6906, 53.2225]),
    ]
    const byCar = estimateRouteSummary(route, 'car')
    const byFoot = estimateRouteSummary(route, 'foot')
    // foot (4.5 km/h) is much slower than car (60 km/h)
    expect(byFoot.durationMin).toBeGreaterThan(byCar.durationMin)
  })

  it('counts stopsCount as route.length - 1', () => {
    const route = [
      pt('a', 'A', [27.5615, 53.9023]),
      pt('b', 'B', [27.6, 53.95]),
      pt('c', 'C', [27.65, 54.0]),
    ]
    const result = estimateRouteSummary(route, 'bike')
    expect(result.stopsCount).toBe(2)
  })
})

describe('fetchMyPlannedTrips backend route_summary mapping', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
    jest.dontMock('@/api/client')
    jest.resetModules()
  })

  it('uses backend route_summary instead of local haversine estimate', async () => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
    const apiClientMock = {
      get: jest.fn(async () => [
        {
          id: 42,
          title: 'Backend route',
          description: 'Uses server summary',
          start_date: '2026-07-04',
          status: 'planned',
          transport_mode: 'bicycle',
          owner: { id: 7, username: 'Owner', avatar: null },
          route: {
            points: [
              {
                id: 1,
                point_type: 'rest',
                order: 0,
                title: 'Start',
                description: 'Meet here',
                lat: 53.9,
                lng: 27.56,
              },
              {
                id: 2,
                place_id: 99,
                point_type: 'travel',
                order: 1,
                title: 'Castle',
                description: 'Server description',
                lat: 53.22,
                lng: 26.69,
              },
            ],
          },
          route_geometry: [
            [27.56, 53.9],
            [27.1, 53.55],
            [26.69, 53.22],
          ],
          route_summary: {
            distance_km: '123.4',
            duration_min: '321',
            elevation_gain_m: '456',
            stops_count: 9,
            provider: 'ors',
            updated_at: '2026-07-04T12:00:00Z',
          },
          routing_state: {
            provider: 'ors',
            is_optimal: true,
            fallback_reason: null,
            // БЭК шлёт warnings и строками, и объектами {code, message} — адаптер нормализует к кодам.
            warnings: [
              { code: 'route_provider_unavailable', message: 'Provider route is unavailable; direct-line fallback was used.' },
              'custom_warning_code',
              { message: 'no code — dropped' },
            ],
          },
          participants: [],
          is_public: false,
          max_participants: 3,
        },
      ]),
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

    const { fetchMyPlannedTrips } = require('@/api/plannedTrips') as typeof import('@/api/plannedTrips')
    const [trip] = await fetchMyPlannedTrips()

    expect(apiClientMock.get).toHaveBeenCalledWith('/trips/planned/me/')
    expect(trip.transport).toBe('bike')
    expect(trip.route[0]).toEqual(expect.objectContaining({
      type: 'rest',
      description: 'Meet here',
    }))
    expect(trip.route[1]).toEqual(expect.objectContaining({
      type: 'place',
      placeId: 99,
      description: 'Server description',
    }))
    expect(trip.routeSummary).toEqual({
      distanceKm: 123.4,
      durationMin: 321,
      elevationGainM: 456,
      stopsCount: 9,
      provider: 'ors',
      updatedAt: '2026-07-04T12:00:00Z',
    })
    expect(trip.routeGeometry).toEqual([
      [27.56, 53.9],
      [27.1, 53.55],
      [26.69, 53.22],
    ])
    expect(trip.routingState).toEqual({
      provider: 'ors',
      isOptimal: true,
      fallbackReason: null,
      warnings: ['route_provider_unavailable', 'custom_warning_code'],
    })
  })

  it('maps production-like minimal trips without throwing on empty route or partial participants', async () => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
    const apiClientMock = {
      get: jest.fn(async () => [
        {
          id: '314',
          title: '  Minimal planned trip  ',
          description: null,
          start_date: '2026-07-11T09:00:00Z',
          status: 'planned',
          owner: '7',
          participants: [{ id: '88', user: null, status: 'accepted' }],
          route: { points: [] },
          route_summary: null,
          routing_state: null,
          is_public: false,
          max_participants: '0',
        },
      ]),
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

    const { fetchMyPlannedTrips } = require('@/api/plannedTrips') as typeof import('@/api/plannedTrips')
    const [trip] = await fetchMyPlannedTrips()

    expect(trip).toEqual(expect.objectContaining({
      id: 314,
      title: 'Minimal planned trip',
      description: '',
      startDate: '2026-07-11T09:00:00Z',
      transport: 'car',
      visibility: 'private',
      seatsTotal: 0,
      status: 'planning',
      route: [],
      routeGeometry: null,
      routeSummary: null,
      routingState: null,
      isOwner: true,
      myRsvp: null,
    }))
    expect(trip.organizer).toEqual({ id: 7, name: '#7', avatarUrl: null })
    expect(trip.participants).toEqual([
      {
        id: 88,
        name: '#88',
        avatarUrl: null,
        rsvp: 'going',
        role: 'participant',
      },
    ])
  })
})

describe('deletePlannedTrip backend endpoint', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
    jest.dontMock('@/api/client')
    jest.resetModules()
  })

  it('uses the generic trip destroy endpoint instead of the planned alias', async () => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
    const apiClientMock = {
      delete: jest.fn(async () => null),
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

    const { deletePlannedTrip } = require('@/api/plannedTrips') as typeof import('@/api/plannedTrips')
    await expect(deletePlannedTrip(42)).resolves.toEqual({ id: 42 })

    expect(apiClientMock.delete).toHaveBeenCalledWith('/trips/42/')
  })
})

describe('fetchRouteTemplates backend endpoint', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
    jest.dontMock('@/api/client')
    jest.resetModules()
  })

  it('requests route templates with the authenticated api client', async () => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
    const apiClientMock = {
      get: jest.fn(async () => [
        {
          id: 1,
          title: 'Template',
          description: 'Route template',
        },
      ]),
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

    const { fetchRouteTemplates } = require('@/api/plannedTrips') as typeof import('@/api/plannedTrips')
    const templates = await fetchRouteTemplates()

    expect(apiClientMock.get).toHaveBeenCalledWith('/trips/route-templates/')
    expect(templates[0]).toEqual(expect.objectContaining({ id: '1', title: 'Template' }))
  })
})

// ── mock fetch functions ──────────────────────────────────────────────────────

describe('fetchMyPlannedTrips (TRIPS_MOCK=true)', () => {
  let fetchMyPlannedTrips: () => Promise<PlannedTrip[]>

  beforeAll(() => {
    process.env.EXPO_PUBLIC_TRIPS_MOCK = 'true'
    jest.resetModules()
    // Re-register mocks after resetModules.
    jest.mock('@/stores/authStore', () => ({
      useAuthStore: { getState: jest.fn(() => ({ userId: null, isAuthenticated: false })) },
    }))
    jest.mock('@/utils/logger', () => ({
      devWarn: jest.fn(),
      devLog: jest.fn(),
      devError: jest.fn(),
    }))
    fetchMyPlannedTrips = require('@/api/plannedTrips').fetchMyPlannedTrips
  })

  afterAll(() => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
  })

  it('resolves to a non-empty array', async () => {
    const trips = await fetchMyPlannedTrips()
    expect(Array.isArray(trips)).toBe(true)
    expect(trips.length).toBeGreaterThan(0)
  })

  it('each trip has required PlannedTrip domain shape', async () => {
    const trips = await fetchMyPlannedTrips()
    for (const trip of trips) {
      expect(typeof trip.id).toBe('number')
      expect(typeof trip.title).toBe('string')
      expect(typeof trip.transport).toBe('string')
      expect(['planning', 'active', 'completed']).toContain(trip.status)
      expect(Array.isArray(trip.participants)).toBe(true)
      expect(Array.isArray(trip.route)).toBe(true)
    }
  })
})

describe('fetchCommunityTrips (TRIPS_MOCK=true)', () => {
  let fetchCommunityTrips: (filters?: import('@/api/plannedTrips').CommunityTripsFilters) => Promise<PlannedTrip[]>

  beforeAll(() => {
    process.env.EXPO_PUBLIC_TRIPS_MOCK = 'true'
    jest.resetModules()
    jest.mock('@/stores/authStore', () => ({
      useAuthStore: { getState: jest.fn(() => ({ userId: null, isAuthenticated: false })) },
    }))
    jest.mock('@/utils/logger', () => ({
      devWarn: jest.fn(),
      devLog: jest.fn(),
      devError: jest.fn(),
    }))
    fetchCommunityTrips = require('@/api/plannedTrips').fetchCommunityTrips
  })

  afterAll(() => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
  })

  it('resolves to an array', async () => {
    const trips = await fetchCommunityTrips()
    expect(Array.isArray(trips)).toBe(true)
  })

  it('only returns publishedToCommunity=true trips', async () => {
    const trips = await fetchCommunityTrips()
    for (const trip of trips) {
      expect(trip.publishedToCommunity).toBe(true)
    }
  })

  it('filters by transport when provided', async () => {
    const allTrips = await fetchCommunityTrips()
    if (allTrips.length === 0) return // nothing to filter

    // Pick a transport present in the community trips.
    const transport = allTrips[0].transport
    const filtered = await fetchCommunityTrips({ transport })
    expect(filtered.length).toBeGreaterThan(0)
    for (const trip of filtered) {
      expect(trip.transport).toBe(transport)
    }
  })
})

describe('createTrip (TRIPS_MOCK=true)', () => {
  let createTrip: (input: CreateTripInput) => Promise<PlannedTrip>

  beforeAll(() => {
    process.env.EXPO_PUBLIC_TRIPS_MOCK = 'true'
    jest.resetModules()
    jest.mock('@/stores/authStore', () => ({
      useAuthStore: { getState: jest.fn(() => ({ userId: null, isAuthenticated: false })) },
    }))
    jest.mock('@/utils/logger', () => ({
      devWarn: jest.fn(),
      devLog: jest.fn(),
      devError: jest.fn(),
    }))
    createTrip = require('@/api/plannedTrips').createTrip
  })

  afterAll(() => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
  })

  const input: CreateTripInput = {
    title: 'Тест-поездка',
    description: 'Описание',
    startDate: '2026-08-01',
    startTime: '09:00',
    transport: 'car',
    visibility: 'public',
    seatsTotal: 6,
    startPoint: null,
  }

  it('returns a PlannedTrip echoing title, transport, seatsTotal', async () => {
    const trip = await createTrip(input)
    expect(trip.title).toBe(input.title)
    expect(trip.transport).toBe(input.transport)
    expect(trip.seatsTotal).toBe(input.seatsTotal)
  })

  it('returned trip has id and status=planning', async () => {
    const trip = await createTrip(input)
    expect(typeof trip.id).toBe('number')
    expect(trip.status).toBe('planning')
  })

  it('returned trip has isOwner=true and myRsvp=going', async () => {
    const trip = await createTrip(input)
    expect(trip.isOwner).toBe(true)
    expect(trip.myRsvp).toBe('going')
  })
})

describe('deletePlannedTrip (TRIPS_MOCK=true)', () => {
  let createTrip: (input: CreateTripInput) => Promise<PlannedTrip>
  let deletePlannedTrip: (tripId: number | string) => Promise<{ id: number }>
  let fetchMyPlannedTrips: () => Promise<PlannedTrip[]>
  let fetchPlannedTrip: (tripId: number | string) => Promise<PlannedTrip>

  beforeAll(() => {
    process.env.EXPO_PUBLIC_TRIPS_MOCK = 'true'
    jest.resetModules()
    jest.mock('@/stores/authStore', () => ({
      useAuthStore: { getState: jest.fn(() => ({ userId: null, isAuthenticated: false })) },
    }))
    jest.mock('@/utils/logger', () => ({
      devWarn: jest.fn(),
      devLog: jest.fn(),
      devError: jest.fn(),
    }))
    const mod = require('@/api/plannedTrips')
    createTrip = mod.createTrip
    deletePlannedTrip = mod.deletePlannedTrip
    fetchMyPlannedTrips = mod.fetchMyPlannedTrips
    fetchPlannedTrip = mod.fetchPlannedTrip
  })

  afterAll(() => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
  })

  it('removes the trip from mock store', async () => {
    const trip = await createTrip({
      title: 'Удаляемая тест-поездка',
      description: 'Описание',
      startDate: '2026-08-01',
      startTime: '09:00',
      transport: 'car',
      visibility: 'public',
      seatsTotal: 4,
      startPoint: null,
    })

    await expect(deletePlannedTrip(trip.id)).resolves.toEqual({ id: trip.id })
    await expect(fetchPlannedTrip(trip.id)).rejects.toThrow()

    const remaining = await fetchMyPlannedTrips()
    expect(remaining.map((item) => item.id)).not.toContain(trip.id)
  })
})

describe('setRsvp (TRIPS_MOCK=true)', () => {
  let setRsvp: (input: RsvpInput) => Promise<PlannedTrip>
  let fetchMyPlannedTrips: () => Promise<PlannedTrip[]>

  beforeAll(() => {
    process.env.EXPO_PUBLIC_TRIPS_MOCK = 'true'
    jest.resetModules()
    jest.mock('@/stores/authStore', () => ({
      useAuthStore: { getState: jest.fn(() => ({ userId: null, isAuthenticated: false })) },
    }))
    jest.mock('@/utils/logger', () => ({
      devWarn: jest.fn(),
      devLog: jest.fn(),
      devError: jest.fn(),
    }))
    const mod = require('@/api/plannedTrips')
    setRsvp = mod.setRsvp
    fetchMyPlannedTrips = mod.fetchMyPlannedTrips
  })

  afterAll(() => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
  })

  it('returns a PlannedTrip with the requested rsvp applied', async () => {
    const trips = await fetchMyPlannedTrips()
    const tripId = trips[0].id
    const trip = await setRsvp({ tripId, rsvp: 'maybe' })
    expect(trip.id).toBe(tripId)
    expect(trip.myRsvp).toBe('maybe')
  })

  it('throws 404 for unknown tripId', async () => {
    await expect(setRsvp({ tripId: 99999, rsvp: 'going' })).rejects.toThrow()
  })
})

describe('submitTripReport (TRIPS_MOCK=true)', () => {
  let submitTripReport: (input: SubmitReportInput) => Promise<PlannedTrip>
  let fetchMyPlannedTrips: () => Promise<PlannedTrip[]>

  beforeAll(() => {
    process.env.EXPO_PUBLIC_TRIPS_MOCK = 'true'
    jest.resetModules()
    jest.mock('@/stores/authStore', () => ({
      useAuthStore: { getState: jest.fn(() => ({ userId: null, isAuthenticated: false })) },
    }))
    jest.mock('@/utils/logger', () => ({
      devWarn: jest.fn(),
      devLog: jest.fn(),
      devError: jest.fn(),
    }))
    const mod = require('@/api/plannedTrips')
    submitTripReport = mod.submitTripReport
    fetchMyPlannedTrips = mod.fetchMyPlannedTrips
  })

  afterAll(() => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
  })

  it('sets trip status to completed and stores report', async () => {
    const trips = await fetchMyPlannedTrips()
    // Use the first planning trip if available, fallback to any.
    const target = trips.find((t) => t.status === 'planning') ?? trips[0]
    const reportInput: SubmitReportInput = {
      tripId: target.id,
      summary: 'Отличная поездка',
      photoUrls: [],
      gpxUrl: null,
      visitedPlaceIds: [],
      publishToCommunity: false,
    }
    const updated = await submitTripReport(reportInput)
    expect(updated.status).toBe('completed')
    expect(updated.report).not.toBeNull()
    expect(updated.report?.summary).toBe('Отличная поездка')
  })
})
