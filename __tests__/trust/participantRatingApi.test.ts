// __tests__/trust/participantRatingApi.test.ts
// Trust & Safety (Sprint 16, FE-431/FE-434): unit-тесты api/participantRating.ts —
// POST/GET контракт оценки участника, валидация 1..5 и typed failures.
// __DEV__=false + без EXPO_PUBLIC_TRIPS_MOCK → бьём по apiClient (не in-memory мок).

delete process.env.EXPO_PUBLIC_TRIPS_MOCK
;(globalThis as any).__DEV__ = false

jest.mock('@/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
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
  devError: jest.fn(),
  devLog: jest.fn(),
}))

jest.mock('@/utils/devMockFlags', () => ({
  resolveDevMockFlag: jest.fn(() => false),
}))

import { apiClient, ApiError } from '@/api/client'
import { getMyParticipantRating, rateParticipant } from '@/api/participantRating'

const mockGet = apiClient.get as jest.Mock
const mockPost = apiClient.post as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe('rateParticipant', () => {
  it('POSTs rating to participants/{userId}/rate/', async () => {
    mockPost.mockResolvedValueOnce(undefined)
    await rateParticipant({ tripId: 10, userId: 5, rating: 4 })
    expect(mockPost).toHaveBeenCalledWith('/trips/10/participants/5/rate/', { rating: 4 })
  })

  it('includes a trimmed review when provided', async () => {
    mockPost.mockResolvedValueOnce(undefined)
    await rateParticipant({ tripId: 10, userId: 5, rating: 5, review: '  отлично  ' })
    expect(mockPost).toHaveBeenCalledWith('/trips/10/participants/5/rate/', {
      rating: 5,
      review: 'отлично',
    })
  })

  it('throws on an out-of-range rating', async () => {
    await expect(
      rateParticipant({ tripId: 1, userId: 1, rating: 0 as 1 }),
    ).rejects.toThrow()
    expect(mockPost).not.toHaveBeenCalled()
  })
})

describe('getMyParticipantRating', () => {
  it('maps a saved rating', async () => {
    mockGet.mockResolvedValueOnce({ rating: 4, review: 'хорошо' })
    expect(await getMyParticipantRating(10, 5)).toEqual({ rating: 4, review: 'хорошо' })
  })

  it('returns null when there is no rating', async () => {
    mockGet.mockResolvedValueOnce(null)
    expect(await getMyParticipantRating(10, 5)).toBeNull()
  })

  it.each([401, 403, 404, 501, 500])('preserves HTTP %s as a typed API failure', async (status) => {
    const error = new ApiError(status)
    mockGet.mockRejectedValueOnce(error)

    await expect(getMyParticipantRating(10, 5)).rejects.toBe(error)
  })

  it('preserves retryable network failures', async () => {
    const error = new ApiError(0, 'offline')
    mockGet.mockRejectedValueOnce(error)

    await expect(getMyParticipantRating(10, 5)).rejects.toBe(error)
  })
})
