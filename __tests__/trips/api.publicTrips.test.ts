// __tests__/trips/api.publicTrips.test.ts
// Unit-тесты слоя публичных поездок: маппер DTO→domain, фильтры, мок-фолбэк и
// переходы статусов заявки (#416 — заявка/одобрение/статусы).

delete process.env.EXPO_PUBLIC_TRIPS_MOCK

jest.mock('@/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
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
  fetchPublicTrips,
  submitApplication,
} from '@/api/publicTrips'
import { MOCK_PUBLIC_TRIPS } from '@/api/publicTripsMock'

const mockGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>
const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>

const tripDto = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  slug: 'trip-1',
  title: 'Тестовая поездка',
  cover_url: null,
  region: 'Минск',
  trip_type: 'Поход',
  start_date: '2026-07-01',
  end_date: '2026-07-02',
  organizer: { id: 5, name: 'Аня', avatar: null },
  seats_total: 6,
  seats_taken: 2,
  status: 'open',
  description: 'desc',
  featured: true,
  my_application_status: null,
  is_owner: false,
  meeting_point: null,
  contact_note: null,
  ...overrides,
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('fetchPublicTrips — mapper', () => {
  it('maps snake_case DTO → camelCase domain', async () => {
    mockGet.mockResolvedValueOnce([tripDto()] as never)
    const trips = await fetchPublicTrips()
    expect(trips).toHaveLength(1)
    expect(trips[0]).toMatchObject({
      id: 1,
      title: 'Тестовая поездка',
      region: 'Минск',
      tripType: 'Поход',
      startDate: '2026-07-01',
      endDate: '2026-07-02',
      seatsTotal: 6,
      seatsTaken: 2,
      status: 'open',
      featured: true,
      isOwner: false,
      organizer: { id: 5, name: 'Аня', avatarUrl: null },
    })
  })

  it('passes filters as query params', async () => {
    mockGet.mockResolvedValueOnce([] as never)
    await fetchPublicTrips({ region: 'Минск', status: 'open' })
    const url = mockGet.mock.calls[0][0] as string
    expect(url).toContain('region=')
    expect(url).toContain('status=open')
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

describe('application status transitions', () => {
  it('submitApplication posts message + social links', async () => {
    mockPost.mockResolvedValueOnce({
      id: 10,
      trip_id: 1,
      trip_title: 'T',
      applicant: { id: 0, name: 'Вы' },
      message: 'hi',
      social_links: ['x'],
      status: 'new',
      created_at: '2026-06-20T00:00:00Z',
    } as never)
    const app = await submitApplication({ tripId: 1, message: 'hi', socialLinks: ['x'] })
    expect(mockPost).toHaveBeenCalledWith('/trips/applications/', {
      trip_id: 1,
      message: 'hi',
      social_links: ['x'],
    })
    expect(app.status).toBe('new')
  })

  it('cancelApplication resolves to cancelled', async () => {
    mockPost.mockResolvedValueOnce({} as never)
    const res = await cancelApplication(10)
    expect(res.status).toBe('cancelled')
  })

  it('decideApplication maps approve→approved and reject→rejected', async () => {
    mockPost.mockResolvedValue({} as never)
    const approved = await decideApplication({ applicationId: 1, tripId: 1, decision: 'approve' })
    expect(approved.status).toBe('approved')
    const rejected = await decideApplication({ applicationId: 2, tripId: 1, decision: 'reject' })
    expect(rejected.status).toBe('rejected')
  })
})
