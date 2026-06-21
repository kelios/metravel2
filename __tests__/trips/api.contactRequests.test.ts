// __tests__/trips/api.contactRequests.test.ts
// Unit tests for api/contactRequests.ts — DTO→domain mapping + mock-fallback (Sprint 15 FE-424).

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

// contactRequests.ts re-exports requestContactAccess from api/privacy.ts.
// Mock privacy to isolate this module from its dependency.
jest.mock('@/api/privacy', () => ({
  requestContactAccess: jest.fn(),
  ContactAccessStatus: {},
}))

import { apiClient, ApiError } from '@/api/client'
import {
  fetchContactRequests,
  updateContactRequest,
  requestContactAccess,
} from '@/api/contactRequests'

const mockGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>
const mockPatch = apiClient.patch as jest.MockedFunction<typeof apiClient.patch>

// ── DTO helpers ───────────────────────────────────────────────────────────────

const profileDto = (overrides: Record<string, unknown> = {}) => ({
  id: 10,
  name: 'Test User',
  avatar: 'https://cdn.example.com/avatar.jpg',
  ...overrides,
})

const contactRequestDto = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  requester: 10,
  requester_profile: profileDto(),
  target: 20,
  target_profile: profileDto({ id: 20, name: 'Target User', avatar: null }),
  status: 'pending' as const,
  created_at: '2026-06-18T12:00:00Z',
  updated_at: null,
  decided_at: null,
  ...overrides,
})

const paged = (results: unknown[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
})

// ── fetchContactRequests ──────────────────────────────────────────────────────

describe('fetchContactRequests — mapper', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('maps ContactAccessRequestDto snake_case to camelCase domain', async () => {
    mockGet.mockResolvedValueOnce(paged([contactRequestDto()]) as never)
    const requests = await fetchContactRequests('received')

    expect(requests).toHaveLength(1)
    const r = requests[0]
    expect(r.id).toBe(1)
    expect(r.status).toBe('pending')
    expect(r.createdAt).toBe('2026-06-18T12:00:00Z')
    expect(r.updatedAt).toBeNull()
    expect(r.decidedAt).toBeNull()

    // No snake_case leaking
    expect((r as any).created_at).toBeUndefined()
    expect((r as any).updated_at).toBeUndefined()
    expect((r as any).decided_at).toBeUndefined()
  })

  it('maps requester profile object to ContactRequestParty', async () => {
    mockGet.mockResolvedValueOnce(paged([contactRequestDto()]) as never)
    const [r] = await fetchContactRequests('received')

    expect(r.requester.id).toBe(10)
    expect(r.requester.name).toBe('Test User')
    expect(r.requester.avatarUrl).toBe('https://cdn.example.com/avatar.jpg')
  })

  it('maps target profile with null avatar to null avatarUrl', async () => {
    mockGet.mockResolvedValueOnce(paged([contactRequestDto()]) as never)
    const [r] = await fetchContactRequests('received')

    expect(r.target.id).toBe(20)
    expect(r.target.name).toBe('Target User')
    expect(r.target.avatarUrl).toBeNull()
  })

  it('falls back to numeric id as name when profile name is absent', async () => {
    const dto = contactRequestDto({
      requester: 77,
      requester_profile: { id: 77, name: null, avatar: null },
    })
    mockGet.mockResolvedValueOnce(paged([dto]) as never)
    const [r] = await fetchContactRequests('received')
    expect(r.requester.name).toBe('#77')
  })

  it('falls back to raw integer id as name when profile is a string', async () => {
    const dto = contactRequestDto({ requester: 88, requester_profile: 'Боря' })
    mockGet.mockResolvedValueOnce(paged([dto]) as never)
    const [r] = await fetchContactRequests('received')
    expect(r.requester.name).toBe('Боря')
    expect(r.requester.avatarUrl).toBeNull()
  })

  it('uses fallback id when profile is null/undefined', async () => {
    const dto = contactRequestDto({ requester: 99, requester_profile: undefined })
    mockGet.mockResolvedValueOnce(paged([dto]) as never)
    const [r] = await fetchContactRequests('received')
    expect(r.requester.id).toBe(99)
    expect(r.requester.name).toBe('#99')
    expect(r.requester.avatarUrl).toBeNull()
  })

  it('handles raw array response (non-paginated)', async () => {
    mockGet.mockResolvedValueOnce([contactRequestDto()] as never)
    const requests = await fetchContactRequests('sent')
    expect(requests).toHaveLength(1)
  })

  it('handles empty paginated result', async () => {
    mockGet.mockResolvedValueOnce(paged([]) as never)
    const requests = await fetchContactRequests('received')
    expect(requests).toEqual([])
  })

  it('includes direction=received in GET query string', async () => {
    mockGet.mockResolvedValueOnce(paged([]) as never)
    await fetchContactRequests('received')
    const url = mockGet.mock.calls[0][0] as string
    expect(url).toContain('direction=received')
  })

  it('includes direction=sent in GET query string', async () => {
    mockGet.mockResolvedValueOnce(paged([]) as never)
    await fetchContactRequests('sent')
    const url = mockGet.mock.calls[0][0] as string
    expect(url).toContain('direction=sent')
  })

  it('includes optional status filter in query string', async () => {
    mockGet.mockResolvedValueOnce(paged([]) as never)
    await fetchContactRequests('received', 'granted')
    const url = mockGet.mock.calls[0][0] as string
    expect(url).toContain('status=granted')
  })

  it('does not include status param when not provided', async () => {
    mockGet.mockResolvedValueOnce(paged([]) as never)
    await fetchContactRequests('received')
    const url = mockGet.mock.calls[0][0] as string
    expect(url).not.toContain('status=')
  })
})

// ── fetchContactRequests — mock-fallback ──────────────────────────────────────

describe('fetchContactRequests — mock-fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('returns mock received list on ApiError(404) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    const requests = await fetchContactRequests('received')
    expect(requests.length).toBeGreaterThan(0)
    // All mock received items should have target.name='Вы'
    expect(requests.every((r) => r.target.name === 'Вы')).toBe(true)
  })

  it('returns mock sent list on ApiError(404) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    const requests = await fetchContactRequests('sent')
    expect(requests.length).toBeGreaterThan(0)
    // All mock sent items should have requester.name='Вы'
    expect(requests.every((r) => r.requester.name === 'Вы')).toBe(true)
  })

  it('filters by status in mock-fallback path', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    const pending = await fetchContactRequests('received', 'pending')
    expect(pending.every((r) => r.status === 'pending')).toBe(true)

    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    const granted = await fetchContactRequests('received', 'granted')
    // All mock received items are pending → filter returns empty
    expect(granted.every((r) => r.status === 'granted')).toBe(true)
  })

  it('returns mock fallback on ApiError(501) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(501))
    const requests = await fetchContactRequests('received')
    expect(requests).toBeDefined()
  })

  it('returns mock fallback on ApiError(0) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(0))
    const requests = await fetchContactRequests('received')
    expect(requests).toBeDefined()
  })

  it('re-throws ApiError(404) when NOT in __DEV__', async () => {
    ;(global as any).__DEV__ = false
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    await expect(fetchContactRequests('received')).rejects.toBeInstanceOf(ApiError)
  })

  it('re-throws non-ApiError regardless of __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new Error('connection refused'))
    await expect(fetchContactRequests('received')).rejects.toThrow('connection refused')
  })
})

// ── updateContactRequest ──────────────────────────────────────────────────────

describe('updateContactRequest — mapper', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('maps PATCH response DTO to domain ContactAccessRequest', async () => {
    const updated = contactRequestDto({ status: 'granted', decided_at: '2026-06-21T10:00:00Z' })
    mockPatch.mockResolvedValueOnce(updated as never)
    const r = await updateContactRequest(1, 'granted')

    expect(r.id).toBe(1)
    expect(r.status).toBe('granted')
    expect(r.decidedAt).toBe('2026-06-21T10:00:00Z')
  })

  it('sends PATCH to /contact-requests/{id}/ with status body', async () => {
    mockPatch.mockResolvedValueOnce(contactRequestDto({ status: 'declined' }) as never)
    await updateContactRequest(1, 'declined')
    expect(mockPatch).toHaveBeenCalledWith('/contact-requests/1/', { status: 'declined' })
  })

  it('supports grant decision', async () => {
    mockPatch.mockResolvedValueOnce(contactRequestDto({ status: 'granted' }) as never)
    const r = await updateContactRequest(1, 'granted')
    expect(r.status).toBe('granted')
  })

  it('supports decline decision', async () => {
    mockPatch.mockResolvedValueOnce(contactRequestDto({ status: 'declined' }) as never)
    const r = await updateContactRequest(1, 'declined')
    expect(r.status).toBe('declined')
  })

  it('supports revoke decision', async () => {
    mockPatch.mockResolvedValueOnce(contactRequestDto({ status: 'revoked' }) as never)
    const r = await updateContactRequest(1, 'revoked')
    expect(r.status).toBe('revoked')
  })

  it('re-throws ApiError when not in DEV', async () => {
    ;(global as any).__DEV__ = false
    mockPatch.mockRejectedValueOnce(new (ApiError as any)(403))
    await expect(updateContactRequest(1, 'granted')).rejects.toBeInstanceOf(ApiError)
  })
})

// ── updateContactRequest — mock-fallback mutation ─────────────────────────────

describe('updateContactRequest — mock-fallback mutation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValue(new (ApiError as any)(404))
    mockPatch.mockRejectedValue(new (ApiError as any)(404))
  })

  afterEach(() => {
    ;(global as any).__DEV__ = false
  })

  it('grant mutates in-memory list — subsequent fetch reflects granted status', async () => {
    // Fetch received to get the initial mock ids
    const before = await fetchContactRequests('received')
    const targetId = before[0].id

    await updateContactRequest(targetId, 'granted')

    const after = await fetchContactRequests('received', 'granted')
    expect(after.some((r) => r.id === targetId)).toBe(true)
  })

  it('decline mutates in-memory list', async () => {
    const before = await fetchContactRequests('received')
    // Pick the second item to avoid id collision with grant test
    const targetId = before[before.length - 1].id

    await updateContactRequest(targetId, 'declined')

    const after = await fetchContactRequests('received', 'declined')
    expect(after.some((r) => r.id === targetId)).toBe(true)
  })

  it('revoke mutates in-memory list on sent requests', async () => {
    const before = await fetchContactRequests('sent')
    const targetId = before[0].id

    await updateContactRequest(targetId, 'revoked')

    const after = await fetchContactRequests('sent', 'revoked')
    expect(after.some((r) => r.id === targetId)).toBe(true)
  })

  it('throws ApiError(404) when trying to update unknown mock id', async () => {
    await expect(updateContactRequest(99999, 'granted')).rejects.toBeInstanceOf(ApiError)
  })

  it('updatedAt and decidedAt are set after decision in mock', async () => {
    const before = await fetchContactRequests('received')
    const targetId = before[0].id

    const result = await updateContactRequest(targetId, 'granted')
    expect(result.updatedAt).not.toBeNull()
    expect(result.decidedAt).not.toBeNull()
  })
})

// ── requestContactAccess re-export ────────────────────────────────────────────

describe('requestContactAccess re-export', () => {
  it('is exported from contactRequests module', () => {
    expect(typeof requestContactAccess).toBe('function')
  })
})

// ── USE_MOCK flag path ────────────────────────────────────────────────────────

describe('fetchContactRequests with EXPO_PUBLIC_TRIPS_MOCK=true', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env.EXPO_PUBLIC_TRIPS_MOCK = 'true'
    jest.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
    jest.resetModules()
  })

  it('returns mock list without calling apiClient', async () => {
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
    jest.mock('@/utils/logger', () => ({ devWarn: jest.fn(), devLog: jest.fn(), devError: jest.fn() }))
    jest.mock('@/api/privacy', () => ({ requestContactAccess: jest.fn() }))

    const { fetchContactRequests: fetchWithMock } = await import('@/api/contactRequests')
    const { apiClient: mockedClient } = await import('@/api/client')

    const requests = await fetchWithMock('received')
    expect(requests.length).toBeGreaterThan(0)
    expect((mockedClient.get as jest.Mock).mock.calls.length).toBe(0)
  })
})
