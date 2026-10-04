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
  reportContent,
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

describe('reportContent (#2133)', () => {
  const comment = { content_type: 'travel_comment' as const, object_id: 15, author_id: 42 }

  it('posts content ref, reason and trimmed comment to /reports/', async () => {
    mockPost.mockResolvedValueOnce({ id: 7, due_at: '2026-10-05T10:00:00Z' })
    const res = await reportContent({ target: comment, reason: 'harassment', comment: '  плохо  ' })
    expect(mockPost).toHaveBeenCalledWith('/reports/', {
      content_type: 'travel_comment',
      object_id: 15,
      reason: 'harassment',
      comment: 'плохо',
    })
    expect(res).toEqual({ id: 7, due_at: '2026-10-05T10:00:00Z' })
  })

  it('reports a profile through the same endpoint with content_type user', async () => {
    mockPost.mockResolvedValueOnce({ id: 8, due_at: '2026-10-05T10:00:00Z' })
    await reportContent({ target: { content_type: 'user', object_id: 42, author_id: 42 }, reason: 'spam' })
    expect(mockPost).toHaveBeenCalledWith('/reports/', { content_type: 'user', object_id: 42, reason: 'spam' })
  })

  it('treats 409 (open report exists) as already reported, not an error', async () => {
    mockPost.mockRejectedValueOnce(new ApiError(409))
    const res = await reportContent({ target: comment, reason: 'spam' })
    expect(res).toEqual({ id: 0, due_at: null })
  })

  it('falls back to mock on 404 in DEV and marks the object reported', async () => {
    mockPost.mockRejectedValueOnce(new ApiError(404))
    const target = { content_type: 'message' as const, object_id: 777, author_id: 3 }
    const res = await reportContent({ target, reason: 'scam' })
    expect(res.due_at).toEqual(expect.any(String))
    expect(isMockReported(target)).toBe(true)
    expect(isMockReported({ content_type: 'travel', object_id: 777 })).toBe(false)
  })

  it('rethrows non-fallback errors (500)', async () => {
    mockPost.mockRejectedValueOnce(new ApiError(500))
    await expect(reportContent({ target: comment, reason: 'other' })).rejects.toMatchObject({
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
