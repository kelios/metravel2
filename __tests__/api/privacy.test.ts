// __tests__/api/privacy.test.ts
// Unit tests for api/privacy.ts (Sprint 18 — Security & Privacy).
// Covers the proposed BE contract + FE-forward graceful degradation (404 → safe defaults).

jest.mock('@/api/client', () => ({
  apiClient: { get: jest.fn(), put: jest.fn(), post: jest.fn(), delete: jest.fn() },
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message?: string) {
      super(message ?? String(status))
      this.status = status
      this.name = 'ApiError'
    }
  },
}))

import { apiClient, ApiError } from '@/api/client'
import {
  fetchPrivacySettings,
  updatePrivacySettings,
  fetchSecurityJournal,
  requestContactAccess,
  requestDataExport,
  deleteUserMessages,
  deleteUserRoutes,
  revokeUserConsents,
  PRIVACY_SETTINGS_DEFAULTS,
} from '@/api/privacy'

const mockGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>
const mockPut = apiClient.put as jest.MockedFunction<typeof apiClient.put>
const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>
const mockDelete = apiClient.delete as jest.MockedFunction<typeof apiClient.delete>

beforeEach(() => {
  jest.clearAllMocks()
})

describe('privacy settings', () => {
  it('returns server values merged over defaults', async () => {
    mockGet.mockResolvedValueOnce({ trips: 'only_me', social: 'followers' } as any)
    const res = await fetchPrivacySettings()
    expect(res.trips).toBe('only_me')
    expect(res.social).toBe('followers')
    // untouched keys fall back to defaults
    expect(res.achievements).toBe(PRIVACY_SETTINGS_DEFAULTS.achievements)
  })

  it('ignores invalid audience values from the server', async () => {
    mockGet.mockResolvedValueOnce({ trips: 'nonsense' } as any)
    const res = await fetchPrivacySettings()
    expect(res.trips).toBe(PRIVACY_SETTINGS_DEFAULTS.trips)
  })

  it('graceful-degrades to defaults when endpoint is missing (404)', async () => {
    mockGet.mockRejectedValueOnce(new ApiError(404, 'Not Found'))
    const res = await fetchPrivacySettings()
    expect(res).toEqual(PRIVACY_SETTINGS_DEFAULTS)
  })

  it('graceful-degrades to defaults when endpoint is not implemented (501)', async () => {
    mockGet.mockRejectedValueOnce(new ApiError(501, 'Not Implemented'))
    const res = await fetchPrivacySettings()
    expect(res).toEqual(PRIVACY_SETTINGS_DEFAULTS)
  })

  it('rethrows non-missing errors (e.g. 500)', async () => {
    mockGet.mockRejectedValueOnce(new ApiError(500, 'boom'))
    await expect(fetchPrivacySettings()).rejects.toBeInstanceOf(ApiError)
  })

  it('PUTs the partial payload and normalizes the response', async () => {
    mockPut.mockResolvedValueOnce({ routes: 'followers' } as any)
    const res = await updatePrivacySettings({ routes: 'followers' })
    expect(mockPut).toHaveBeenCalledWith('/user/privacy-settings/', { routes: 'followers' })
    expect(res.routes).toBe('followers')
    expect(res.trips).toBe(PRIVACY_SETTINGS_DEFAULTS.trips)
  })
})

describe('security journal', () => {
  it('maps results and computes nextPage from "next"', async () => {
    mockGet.mockResolvedValueOnce({
      results: [{ id: 1, event_type: 'login', created_at: '2026-06-20T10:00:00Z' }],
      count: 5,
      next: 'http://x/?page=2',
    } as any)
    const page = await fetchSecurityJournal(1)
    expect(page.results).toHaveLength(1)
    expect(page.count).toBe(5)
    expect(page.nextPage).toBe(2)
  })

  it('coerces unknown event types to "other"', async () => {
    mockGet.mockResolvedValueOnce({
      results: [{ id: 1, event_type: 'weird', created_at: '2026-06-20T10:00:00Z' }],
      count: 1,
      next: null,
    } as any)
    const page = await fetchSecurityJournal(1)
    expect(page.results[0].event_type).toBe('other')
    expect(page.nextPage).toBeNull()
  })

  it('graceful-degrades to empty page when endpoint is missing', async () => {
    mockGet.mockRejectedValueOnce(new ApiError(404, 'Not Found'))
    const page = await fetchSecurityJournal(1)
    expect(page).toEqual({ results: [], count: 0, nextPage: null })
  })
})

describe('contact protection + data ownership endpoints', () => {
  it('requests contact access at the per-user endpoint', async () => {
    mockPost.mockResolvedValueOnce({ status: 'pending' } as any)
    const res = await requestContactAccess(42)
    expect(mockPost).toHaveBeenCalledWith('/user/42/contact-request/')
    expect(res.status).toBe('pending')
  })

  it('hits the documented data-ownership endpoints', async () => {
    mockPost.mockResolvedValue({ status: 'queued' } as any)
    mockDelete.mockResolvedValue(null as any)

    await requestDataExport()
    expect(mockPost).toHaveBeenCalledWith('/user/data-export/')

    await deleteUserMessages()
    expect(mockDelete).toHaveBeenCalledWith('/user/data/messages/')

    await deleteUserRoutes()
    expect(mockDelete).toHaveBeenCalledWith('/user/data/routes/')

    await revokeUserConsents()
    expect(mockPost).toHaveBeenCalledWith('/user/consents/revoke/')
  })
})
