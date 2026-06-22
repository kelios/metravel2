// __tests__/trips/api.publicTrips.test.ts
// Unit-тесты слоя публичных поездок. Контракт сверен с задеплоенным бэком
// (openapi /api/schema/): пагинация DRF, реальные поля PublicTripCatalog/
// TripApplication, PATCH для смены статуса заявки.

delete process.env.EXPO_PUBLIC_TRIPS_MOCK

jest.mock('@/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message?: string) {
      super(message ?? String(status))
      this.status = status
      this.name = 'ApiError'
    }
  },
}))

jest.mock('@/utils/logger', () => ({
  devWarn: jest.fn(),
  devLog: jest.fn(),
  devError: jest.fn(),
}))

import { apiClient, ApiError } from '@/api/client'
import {
  cancelApplication,
  decideApplication,
  fetchPublicTrip,
  fetchPublicTrips,
  submitApplication,
} from '@/api/publicTrips'
import { MOCK_PUBLIC_TRIPS } from '@/api/publicTripsMock'

const mockGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>
const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>
const mockPatch = apiClient.patch as jest.MockedFunction<typeof apiClient.patch>

// PublicTripCatalog DTO (реальные поля BE).
const tripDto = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  owner: 5,
  // BE отдаёт профиль вложенным объектом (в openapi помечен как string).
  owner_profile: { id: 5, name: 'Аня', avatar: 'http://cdn/ann.jpg' },
  title: 'Тестовая поездка',
  description: 'desc',
  start_at: '2026-07-01T08:00:00Z',
  transport_mode: 'car',
  is_public: true,
  seats_count: 6,
  start_point_name: 'Минск',
  status: 'planned',
  catalog_status: 'open',
  going_participants_count: 2,
  available_seats: 4,
  ...overrides,
})

// DRF-пагинированный ответ.
const paged = (results: unknown[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('fetchPublicTrips — mapper', () => {
  it('maps PublicTripCatalog DTO → domain', async () => {
    mockGet.mockResolvedValueOnce(paged([tripDto()]) as never)
    const trips = await fetchPublicTrips()
    expect(trips).toHaveLength(1)
    expect(trips[0]).toMatchObject({
      id: 1,
      title: 'Тестовая поездка',
      region: 'Минск',
      tripType: 'car',
      startDate: '2026-07-01T08:00:00Z',
      seatsTotal: 6,
      seatsTaken: 2,
      status: 'open',
      organizer: { id: 5, name: 'Аня', avatarUrl: 'http://cdn/ann.jpg' },
    })
  })

  it('tolerates owner_profile returned as a bare string', async () => {
    mockGet.mockResolvedValueOnce(paged([tripDto({ owner_profile: 'Боря' })]) as never)
    const trips = await fetchPublicTrips()
    expect(trips[0].organizer).toMatchObject({ id: 5, name: 'Боря', avatarUrl: null })
  })

  it('derives full status when no seats available', async () => {
    mockGet.mockResolvedValueOnce(
      paged([tripDto({ available_seats: 0, going_participants_count: 6 })]) as never,
    )
    const trips = await fetchPublicTrips()
    expect(trips[0].status).toBe('full')
  })

  it('hits the real /public-trips/ endpoint with pagination', async () => {
    mockGet.mockResolvedValueOnce(paged([]) as never)
    await fetchPublicTrips()
    const url = mockGet.mock.calls[0][0] as string
    expect(url).toContain('/public-trips/')
    expect(url).toContain('perPage=')
  })

  it('applies domain filters client-side', async () => {
    mockGet.mockResolvedValueOnce(
      paged([
        tripDto({ id: 1, status: 'completed', catalog_status: 'completed' }),
        tripDto({ id: 2 }),
      ]) as never,
    )
    const trips = await fetchPublicTrips({ status: 'open' })
    expect(trips.map((t) => t.id)).toEqual([2])
  })

  it('falls back to mock on 404 in DEV', async () => {
    const prev = (globalThis as Record<string, unknown>).__DEV__
    ;(globalThis as Record<string, unknown>).__DEV__ = true
    mockGet.mockRejectedValueOnce(new ApiError(404, 'not found'))
    const trips = await fetchPublicTrips()
    expect(trips.length).toBe(MOCK_PUBLIC_TRIPS.length)
    ;(globalThis as Record<string, unknown>).__DEV__ = prev
  })

  it('re-throws non-fallback errors', async () => {
    mockGet.mockRejectedValueOnce(new ApiError(500, 'server error'))
    await expect(fetchPublicTrips()).rejects.toThrow()
  })
})

describe('fetchPublicTrip — post-approval reveal (#410)', () => {
  it('одобренному раскрывает место встречи (координаты пришли)', async () => {
    mockGet.mockResolvedValueOnce(
      tripDto({
        meeting_point_hidden: false,
        start_point_name: 'Минск, вокзал',
        start_lat: 53.89,
        start_lng: 27.55,
      }),
    )
    const trip = await fetchPublicTrip(6)
    expect(trip.meetingPoint).toBe('Минск, вокзал · 53.89, 27.55')
  })

  it('детальный GET идёт С токеном (skipAuth не передаётся)', async () => {
    mockGet.mockResolvedValueOnce(tripDto())
    await fetchPublicTrip(6)
    const opts = mockGet.mock.calls[0]?.[2] as { skipAuth?: boolean } | undefined
    expect(opts?.skipAuth).toBeFalsy()
  })

  it('анониму место встречи скрыто (координат нет, hidden=true)', async () => {
    mockGet.mockResolvedValueOnce(
      tripDto({
        meeting_point_hidden: true,
        start_point_name: 'Минск, вокзал',
        start_lat: null,
        start_lng: null,
      }),
    )
    const trip = await fetchPublicTrip(6)
    expect(trip.meetingPoint).toBeNull()
  })
})

describe('application status transitions', () => {
  it('submitApplication posts trip + message + platform links to /trip-applications/', async () => {
    mockPost.mockResolvedValueOnce({
      id: 10,
      trip: 1,
      trip_title: 'T',
      applicant: 0,
      applicant_profile: 'Вы',
      message: 'hi',
      telegram: 'https://t.me/me',
      status: 'new',
      created_at: '2026-06-20T00:00:00Z',
    } as never)
    const app = await submitApplication({
      tripId: 1,
      message: 'hi',
      socialLinks: ['https://t.me/me'],
    })
    expect(mockPost).toHaveBeenCalledWith('/trip-applications/', {
      trip: 1,
      message: 'hi',
      telegram: 'https://t.me/me',
    })
    expect(app.status).toBe('new')
    expect(app.tripId).toBe(1)
  })

  it('cancelApplication PATCHes status=canceled and resolves to cancelled', async () => {
    mockPatch.mockResolvedValueOnce({} as never)
    const res = await cancelApplication(10)
    expect(mockPatch).toHaveBeenCalledWith('/trip-applications/10/', { status: 'canceled' })
    expect(res.status).toBe('cancelled')
  })

  it('decideApplication PATCHes approved/rejected', async () => {
    mockPatch.mockResolvedValue({} as never)
    const approved = await decideApplication({ applicationId: 1, tripId: 1, decision: 'approve' })
    expect(mockPatch).toHaveBeenCalledWith('/trip-applications/1/', { status: 'approved' })
    expect(approved.status).toBe('approved')
    const rejected = await decideApplication({ applicationId: 2, tripId: 1, decision: 'reject' })
    expect(mockPatch).toHaveBeenCalledWith('/trip-applications/2/', { status: 'rejected' })
    expect(rejected.status).toBe('rejected')
  })
})
