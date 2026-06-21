// __tests__/trips/api.tripTelegramGroup.test.ts
// Unit tests for api/tripTelegramGroup.ts — DTO→domain mapping + mock-fallback (Sprint 15 FE-423).

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
  fetchTripTelegramGroup,
  createTripTelegramGroup,
  fetchTripInviteLink,
} from '@/api/tripTelegramGroup'

const mockGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>
const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>

const groupDto = (overrides: Record<string, unknown> = {}) => ({
  trip: 10,
  enabled: true,
  group_url: 'https://t.me/+test_group',
  invite_url: 'https://t.me/+test_invite',
  share_text: 'Join our trip group!',
  created_by: 104,
  created_at: '2026-06-20T09:00:00Z',
  ...overrides,
})

const inviteLinkDto = (overrides: Record<string, unknown> = {}) => ({
  url: 'https://t.me/+invite_link',
  text: 'Join the trip Telegram group',
  ...overrides,
})

// ── fetchTripTelegramGroup ────────────────────────────────────────────────────

describe('fetchTripTelegramGroup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('maps TelegramGroupDto snake_case to camelCase domain', async () => {
    mockGet.mockResolvedValueOnce(groupDto() as never)
    const group = await fetchTripTelegramGroup(10)

    expect(group.tripId).toBe(10)
    expect(group.enabled).toBe(true)
    expect(group.groupUrl).toBe('https://t.me/+test_group')
    expect(group.inviteUrl).toBe('https://t.me/+test_invite')
    expect(group.shareText).toBe('Join our trip group!')
    expect(group.createdBy).toBe(104)
    expect(group.createdAt).toBe('2026-06-20T09:00:00Z')

    // No snake_case leaking
    expect((group as any).group_url).toBeUndefined()
    expect((group as any).invite_url).toBeUndefined()
    expect((group as any).share_text).toBeUndefined()
    expect((group as any).created_by).toBeUndefined()
    expect((group as any).created_at).toBeUndefined()
  })

  it('maps null optional fields correctly', async () => {
    mockGet.mockResolvedValueOnce(
      groupDto({ group_url: null, invite_url: null, created_by: null, created_at: null }) as never,
    )
    const group = await fetchTripTelegramGroup(10)

    expect(group.groupUrl).toBeNull()
    expect(group.inviteUrl).toBeNull()
    expect(group.createdBy).toBeNull()
    expect(group.createdAt).toBeNull()
  })

  it('defaults shareText to empty string when share_text is absent', async () => {
    mockGet.mockResolvedValueOnce(groupDto({ share_text: undefined }) as never)
    const group = await fetchTripTelegramGroup(10)
    expect(group.shareText).toBe('')
  })

  it('calls the correct endpoint', async () => {
    mockGet.mockResolvedValueOnce(groupDto() as never)
    await fetchTripTelegramGroup(10)
    expect(mockGet).toHaveBeenCalledWith('/trips/10/telegram-group/')
  })

  it('returns disabled mock on ApiError(404) in __DEV__ for unknown trip', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    const group = await fetchTripTelegramGroup(5)
    expect(group.tripId).toBe(5)
    expect(group.enabled).toBe(false)
    expect(group.groupUrl).toBeNull()
    expect(group.inviteUrl).toBeNull()
  })

  it('returns mock fallback on ApiError(501) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(501))
    const group = await fetchTripTelegramGroup(5)
    expect(group).toBeDefined()
  })

  it('returns mock fallback on ApiError(0) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(0))
    const group = await fetchTripTelegramGroup(5)
    expect(group).toBeDefined()
  })

  it('re-throws ApiError(404) when NOT in __DEV__', async () => {
    ;(global as any).__DEV__ = false
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    await expect(fetchTripTelegramGroup(10)).rejects.toBeInstanceOf(ApiError)
  })

  it('re-throws non-ApiError regardless of __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new Error('DNS failure'))
    await expect(fetchTripTelegramGroup(10)).rejects.toThrow('DNS failure')
  })
})

// ── createTripTelegramGroup ───────────────────────────────────────────────────

describe('createTripTelegramGroup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('maps POST response DTO to domain', async () => {
    mockPost.mockResolvedValueOnce(groupDto({ enabled: true }) as never)
    const group = await createTripTelegramGroup({ tripId: 10 })

    expect(group.tripId).toBe(10)
    expect(group.enabled).toBe(true)
    expect(group.groupUrl).toBe('https://t.me/+test_group')
  })

  it('sends correct body to API — enabled:true and snake_case urls', async () => {
    mockPost.mockResolvedValueOnce(groupDto() as never)
    await createTripTelegramGroup({
      tripId: 10,
      groupUrl: 'https://t.me/mygroup',
      inviteUrl: 'https://t.me/+invite',
    })

    expect(mockPost).toHaveBeenCalledWith('/trips/10/telegram-group/', {
      enabled: true,
      group_url: 'https://t.me/mygroup',
      invite_url: 'https://t.me/+invite',
    })
  })

  it('sends null urls when not provided', async () => {
    mockPost.mockResolvedValueOnce(groupDto() as never)
    await createTripTelegramGroup({ tripId: 10 })

    expect(mockPost).toHaveBeenCalledWith('/trips/10/telegram-group/', {
      enabled: true,
      group_url: null,
      invite_url: null,
    })
  })

  it('mock-fallback create enables group and yields t.me invite url', async () => {
    ;(global as any).__DEV__ = true
    // Use a unique tripId to avoid state pollution from other DEV-path tests
    const TRIP = 400
    mockPost.mockRejectedValueOnce(new (ApiError as any)(404))
    const group = await createTripTelegramGroup({ tripId: TRIP })

    expect(group.enabled).toBe(true)
    expect(group.groupUrl).toMatch(/^https:\/\/t\.me\//)
    expect(group.inviteUrl).toMatch(/^https:\/\/t\.me\//)
    expect(group.shareText).toContain('https://t.me/')
  })

  it('mock-fallback uses provided groupUrl when supplied', async () => {
    ;(global as any).__DEV__ = true
    const TRIP = 401
    mockPost.mockRejectedValueOnce(new (ApiError as any)(404))
    const group = await createTripTelegramGroup({
      tripId: TRIP,
      groupUrl: 'https://t.me/+customgroup',
    })

    expect(group.groupUrl).toBe('https://t.me/+customgroup')
  })

  it('re-throws ApiError when not in DEV', async () => {
    ;(global as any).__DEV__ = false
    mockPost.mockRejectedValueOnce(new (ApiError as any)(404))
    await expect(createTripTelegramGroup({ tripId: 10 })).rejects.toBeInstanceOf(ApiError)
  })
})

// ── fetchTripInviteLink ───────────────────────────────────────────────────────

describe('fetchTripInviteLink', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('maps InviteLinkDto to domain', async () => {
    mockPost.mockResolvedValueOnce(inviteLinkDto() as never)
    const invite = await fetchTripInviteLink(10)

    expect(invite.url).toBe('https://t.me/+invite_link')
    expect(invite.text).toBe('Join the trip Telegram group')
  })

  it('defaults text to empty string when absent', async () => {
    mockPost.mockResolvedValueOnce(inviteLinkDto({ text: undefined }) as never)
    const invite = await fetchTripInviteLink(10)
    expect(invite.text).toBe('')
  })

  it('calls the correct invite-link endpoint', async () => {
    mockPost.mockResolvedValueOnce(inviteLinkDto() as never)
    await fetchTripInviteLink(10)
    expect(mockPost).toHaveBeenCalledWith('/trips/10/telegram-group/invite-link/')
  })

  it('returns url and text from mock fallback in __DEV__ on ApiError(404)', async () => {
    ;(global as any).__DEV__ = true
    // Use a fresh tripId so group state starts as disabled
    const TRIP = 500
    mockPost.mockRejectedValueOnce(new (ApiError as any)(404))
    const invite = await fetchTripInviteLink(TRIP)

    expect(invite.url).toMatch(/^https:\/\/t\.me\//)
    expect(invite.text).toContain('https://t.me/')
  })

  it('invite link url reflects previously created group url in DEV state', async () => {
    ;(global as any).__DEV__ = true
    const TRIP = 501
    // First create the group in mock state
    mockPost.mockRejectedValueOnce(new (ApiError as any)(404))
    await createTripTelegramGroup({ tripId: TRIP, groupUrl: 'https://t.me/+thegroup' })

    // Now fetch invite link — should reflect the group url
    mockPost.mockRejectedValueOnce(new (ApiError as any)(404))
    const invite = await fetchTripInviteLink(TRIP)
    expect(invite.url).toBe('https://t.me/+thegroup')
  })

  it('re-throws ApiError when not in DEV', async () => {
    ;(global as any).__DEV__ = false
    mockPost.mockRejectedValueOnce(new (ApiError as any)(404))
    await expect(fetchTripInviteLink(10)).rejects.toBeInstanceOf(ApiError)
  })
})

// ── USE_MOCK flag path ────────────────────────────────────────────────────────

describe('fetchTripTelegramGroup with EXPO_PUBLIC_TRIPS_MOCK=true', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env.EXPO_PUBLIC_TRIPS_MOCK = 'true'
    jest.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
    jest.resetModules()
  })

  it('returns disabled group without calling apiClient for unseen trip', async () => {
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

    const { fetchTripTelegramGroup: fetchWithMock } = await import('@/api/tripTelegramGroup')
    const { apiClient: mockedClient } = await import('@/api/client')

    const group = await fetchWithMock(9999)
    expect(group.enabled).toBe(false)
    expect((mockedClient.get as jest.Mock).mock.calls.length).toBe(0)
  })

  it('create then fetch shows enabled group without apiClient', async () => {
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

    const { fetchTripTelegramGroup: fetchWithMock, createTripTelegramGroup: createWithMock } =
      await import('@/api/tripTelegramGroup')
    const { apiClient: mockedClient } = await import('@/api/client')

    await createWithMock({ tripId: 8888 })
    const group = await fetchWithMock(8888)

    expect(group.enabled).toBe(true)
    expect(group.groupUrl).toMatch(/^https:\/\/t\.me\//)
    expect((mockedClient.get as jest.Mock).mock.calls.length).toBe(0)
    expect((mockedClient.post as jest.Mock).mock.calls.length).toBe(0)
  })
})
