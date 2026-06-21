// __tests__/trust/userSafetyApi.test.ts
// Trust & Safety (Sprint 16, FE-430/FE-434): unit-тесты api/userSafety.ts —
// report/block контракт, дефолтный справочник причин, 409-идемпотентность,
// мок-фолбэк на 404 в DEV.

delete process.env.EXPO_PUBLIC_SAFETY_MOCK
;(globalThis as any).__DEV__ = true

jest.mock('@/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
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
  devLog: jest.fn(),
  devError: jest.fn(),
}))

import { apiClient, ApiError } from '@/api/client'
import {
  DEFAULT_REPORT_REASONS,
  blockUser,
  fetchBlockedUsers,
  fetchReportReasons,
  isMockBlocked,
  isMockReported,
  reportUser,
  unblockUser,
} from '@/api/userSafety'

const mockGet = apiClient.get as jest.Mock
const mockPost = apiClient.post as jest.Mock
const mockDelete = apiClient.delete as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe('fetchReportReasons', () => {
  it('returns the server list when non-empty', async () => {
    mockGet.mockResolvedValueOnce([{ key: 'spam', label: 'Спам' }])
    expect(await fetchReportReasons()).toEqual([{ key: 'spam', label: 'Спам' }])
  })

  it('falls back to defaults when server returns empty', async () => {
    mockGet.mockResolvedValueOnce([])
    expect(await fetchReportReasons()).toBe(DEFAULT_REPORT_REASONS)
  })

  it('falls back to defaults on 404 in DEV', async () => {
    mockGet.mockRejectedValueOnce(new ApiError(404))
    expect(await fetchReportReasons()).toBe(DEFAULT_REPORT_REASONS)
  })
})

describe('reportUser', () => {
  it('posts reason (+comment) to the user report endpoint', async () => {
    mockPost.mockResolvedValueOnce({ id: 7, status: 'pending' })
    const res = await reportUser({ userId: 42, reason: 'harassment', comment: '  плохо  ' })
    expect(mockPost).toHaveBeenCalledWith('/user/42/report/', {
      reason: 'harassment',
      comment: 'плохо',
    })
    expect(res).toEqual({ id: 7, status: 'pending' })
  })

  it('omits empty comment from the body', async () => {
    mockPost.mockResolvedValueOnce({ id: 8, status: 'pending' })
    await reportUser({ userId: 42, reason: 'spam' })
    expect(mockPost).toHaveBeenCalledWith('/user/42/report/', { reason: 'spam' })
  })

  it('treats 409 (already reported) as a pending report, not an error', async () => {
    mockPost.mockRejectedValueOnce(new ApiError(409))
    const res = await reportUser({ userId: 42, reason: 'spam' })
    expect(res.status).toBe('pending')
  })

  it('falls back to mock on 404 in DEV and marks reported', async () => {
    mockPost.mockRejectedValueOnce(new ApiError(404))
    const res = await reportUser({ userId: 777, reason: 'scam' })
    expect(res.status).toBe('pending')
    expect(isMockReported(777)).toBe(true)
  })

  it('rethrows non-fallback errors (500)', async () => {
    mockPost.mockRejectedValueOnce(new ApiError(500))
    await expect(reportUser({ userId: 1, reason: 'other' })).rejects.toMatchObject({
      status: 500,
    })
  })
})

describe('block / unblock', () => {
  it('POSTs to the block endpoint', async () => {
    mockPost.mockResolvedValueOnce(undefined)
    await blockUser(99)
    expect(mockPost).toHaveBeenCalledWith('/user/99/block/')
  })

  it('DELETEs to the block endpoint on unblock', async () => {
    mockDelete.mockResolvedValueOnce(undefined)
    await unblockUser(99)
    expect(mockDelete).toHaveBeenCalledWith('/user/99/block/')
  })

  it('falls back to mock on 404 and marks blocked / unblocked', async () => {
    mockPost.mockRejectedValueOnce(new ApiError(404))
    await blockUser(888)
    expect(isMockBlocked(888)).toBe(true)

    mockDelete.mockRejectedValueOnce(new ApiError(404))
    await unblockUser(888)
    expect(isMockBlocked(888)).toBe(false)
  })
})

describe('fetchBlockedUsers', () => {
  it('unwraps a paginated payload', async () => {
    mockGet.mockResolvedValueOnce({ results: [{ id: 1 }, { id: 2 }] })
    const res = await fetchBlockedUsers()
    expect(res).toHaveLength(2)
  })

  it('unwraps a bare array', async () => {
    mockGet.mockResolvedValueOnce([{ id: 1 }])
    expect(await fetchBlockedUsers()).toHaveLength(1)
  })
})
