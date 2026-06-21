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
