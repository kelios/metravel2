// __tests__/trips/api.telegramLink.test.ts
// Unit tests for api/telegramLink.ts — DTO→domain mapping + mock-fallback (Sprint 15 FE-421).

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
  fetchMyTelegramLink,
  updateTelegramLink,
  startTelegramAuth,
  confirmTelegramAuth,
} from '@/api/telegramLink'

const mockGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>
const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>
const mockPatch = apiClient.patch as jest.MockedFunction<typeof apiClient.patch>

const telegramLinkDto = (overrides: Record<string, unknown> = {}) => ({
  telegram_username: 'testuser',
  telegram_user_id: '123456789',
  telegram_verified: true,
  preferred_messenger: 'telegram' as const,
  ...overrides,
})

// ── fetchMyTelegramLink ───────────────────────────────────────────────────────

describe('fetchMyTelegramLink', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('maps snake_case DTO to camelCase TelegramLink domain', async () => {
    mockGet.mockResolvedValueOnce(telegramLinkDto() as never)
    const link = await fetchMyTelegramLink()

    expect(link.telegramUsername).toBe('testuser')
    expect(link.telegramUserId).toBe('123456789')
    expect(link.telegramVerified).toBe(true)
    expect(link.preferredMessenger).toBe('telegram')

    // No snake_case leaking
    expect((link as any).telegram_username).toBeUndefined()
    expect((link as any).telegram_user_id).toBeUndefined()
    expect((link as any).telegram_verified).toBeUndefined()
    expect((link as any).preferred_messenger).toBeUndefined()
  })

  it('maps null fields to null in domain type', async () => {
    mockGet.mockResolvedValueOnce(
      telegramLinkDto({ telegram_username: null, telegram_user_id: null, preferred_messenger: null }) as never,
    )
    const link = await fetchMyTelegramLink()

    expect(link.telegramUsername).toBeNull()
    expect(link.telegramUserId).toBeNull()
    expect(link.preferredMessenger).toBeNull()
  })

  it('coerces telegram_verified false correctly', async () => {
    mockGet.mockResolvedValueOnce(telegramLinkDto({ telegram_verified: false }) as never)
    const link = await fetchMyTelegramLink()
    expect(link.telegramVerified).toBe(false)
  })

  it('calls the correct endpoint', async () => {
    mockGet.mockResolvedValueOnce(telegramLinkDto() as never)
    await fetchMyTelegramLink()
    expect(mockGet).toHaveBeenCalledWith('/user/me/telegram/')
  })

  it('returns mock fallback on ApiError(404) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    const link = await fetchMyTelegramLink()
    // Mock state initial value — preferred_messenger defaults to 'telegram'
    expect(link.preferredMessenger).toBe('telegram')
    expect(link.telegramVerified).toBe(false)
  })

  it('returns mock fallback on ApiError(501) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(501))
    const link = await fetchMyTelegramLink()
    expect(link).toBeDefined()
  })

  it('returns mock fallback on ApiError(0) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(0))
    const link = await fetchMyTelegramLink()
    expect(link).toBeDefined()
  })

  it('re-throws ApiError(404) when NOT in __DEV__', async () => {
    ;(global as any).__DEV__ = false
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    await expect(fetchMyTelegramLink()).rejects.toBeInstanceOf(ApiError)
  })

  it('re-throws non-ApiError regardless of __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new Error('Network error'))
    await expect(fetchMyTelegramLink()).rejects.toThrow('Network error')
  })
})

// ── updateTelegramLink ───────────────────────────────────────────────────────

describe('updateTelegramLink', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('maps PATCH response DTO to camelCase domain', async () => {
    mockPatch.mockResolvedValueOnce(
      telegramLinkDto({ telegram_username: 'newuser', telegram_verified: false }) as never,
    )
    const link = await updateTelegramLink({ telegramUsername: 'newuser' })

    expect(link.telegramUsername).toBe('newuser')
    expect(link.telegramVerified).toBe(false)
  })

  it('sends snake_case body to API', async () => {
    mockPatch.mockResolvedValueOnce(telegramLinkDto({ telegram_username: 'alice' }) as never)
    await updateTelegramLink({ telegramUsername: 'alice', preferredMessenger: 'whatsapp' })

    expect(mockPatch).toHaveBeenCalledWith(
      '/user/me/telegram/',
      expect.objectContaining({
        telegram_username: 'alice',
        preferred_messenger: 'whatsapp',
      }),
    )
  })

  it('strips leading @ from username before sending', async () => {
    mockPatch.mockResolvedValueOnce(telegramLinkDto({ telegram_username: 'bob' }) as never)
    await updateTelegramLink({ telegramUsername: '@bob' })

    expect(mockPatch).toHaveBeenCalledWith(
      '/user/me/telegram/',
      expect.objectContaining({ telegram_username: 'bob' }),
    )
  })

  it('sends null username when empty string provided', async () => {
    mockPatch.mockResolvedValueOnce(telegramLinkDto({ telegram_username: null }) as never)
    await updateTelegramLink({ telegramUsername: '   ' })

    expect(mockPatch).toHaveBeenCalledWith(
      '/user/me/telegram/',
      expect.objectContaining({ telegram_username: null }),
    )
  })

  it('applies mock fallback in DEV on ApiError(404) — mutates mock state', async () => {
    ;(global as any).__DEV__ = true
    mockPatch.mockRejectedValueOnce(new (ApiError as any)(404))

    const link = await updateTelegramLink({ preferredMessenger: 'other' })
    expect(link.preferredMessenger).toBe('other')
  })

  it('re-throws ApiError when not in DEV', async () => {
    ;(global as any).__DEV__ = false
    mockPatch.mockRejectedValueOnce(new (ApiError as any)(404))
    await expect(updateTelegramLink({ telegramUsername: 'x' })).rejects.toBeInstanceOf(ApiError)
  })
})

// ── startTelegramAuth ─────────────────────────────────────────────────────────

describe('startTelegramAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('maps auth start DTO to domain shape', async () => {
    const expires = '2026-07-01T00:00:00Z'
    mockPost.mockResolvedValueOnce({
      deeplink: 'https://t.me/metravel_bot?start=abc',
      expires_at: expires,
    } as never)

    const result = await startTelegramAuth()
    expect(result.deeplink).toBe('https://t.me/metravel_bot?start=abc')
    expect(result.expiresAt).toBe(expires)
    expect((result as any).expires_at).toBeUndefined()
  })

  it('calls correct endpoint', async () => {
    mockPost.mockResolvedValueOnce({ deeplink: 'https://t.me/x', expires_at: '' } as never)
    await startTelegramAuth()
    expect(mockPost).toHaveBeenCalledWith('/user/me/telegram/auth/start/')
  })

  it('returns mock deeplink via t.me on ApiError(404) in DEV', async () => {
    ;(global as any).__DEV__ = true
    mockPost.mockRejectedValueOnce(new (ApiError as any)(404))
    const result = await startTelegramAuth()
    expect(result.deeplink).toMatch(/^https:\/\/t\.me\//)
    expect(result.expiresAt).toBeDefined()
  })

  it('re-throws ApiError when not in DEV', async () => {
    ;(global as any).__DEV__ = false
    mockPost.mockRejectedValueOnce(new (ApiError as any)(404))
    await expect(startTelegramAuth()).rejects.toBeInstanceOf(ApiError)
  })
})

// ── confirmTelegramAuth ───────────────────────────────────────────────────────

describe('confirmTelegramAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('posts token and returns telegramVerified: true on success', async () => {
    mockPost.mockResolvedValueOnce({ telegram_verified: true } as never)
    const result = await confirmTelegramAuth('my-token')

    expect(result.telegramVerified).toBe(true)
    expect(mockPost).toHaveBeenCalledWith('/user/me/telegram/auth/confirm/', { token: 'my-token' })
  })

  it('returns mock telegramVerified: true on ApiError(404) in DEV', async () => {
    ;(global as any).__DEV__ = true
    mockPost.mockRejectedValueOnce(new (ApiError as any)(404))
    const result = await confirmTelegramAuth('tok')
    expect(result.telegramVerified).toBe(true)
  })

  it('re-throws ApiError when not in DEV', async () => {
    ;(global as any).__DEV__ = false
    mockPost.mockRejectedValueOnce(new (ApiError as any)(404))
    await expect(confirmTelegramAuth('tok')).rejects.toBeInstanceOf(ApiError)
  })
})

// ── EXPO_PUBLIC_TRIPS_MOCK=true path ──────────────────────────────────────────

describe('fetchMyTelegramLink with USE_MOCK flag', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env.EXPO_PUBLIC_TRIPS_MOCK = 'true'
    jest.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
    jest.resetModules()
  })

  it('returns mock without calling apiClient when USE_MOCK=true', async () => {
    // Re-require so USE_MOCK is evaluated fresh
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

    const { fetchMyTelegramLink: fetchWithMock } = await import('@/api/telegramLink')
    const { apiClient: mockedClient } = await import('@/api/client')

    const link = await fetchWithMock()
    expect(link).toBeDefined()
    expect((mockedClient.get as jest.Mock).mock.calls.length).toBe(0)
  })
})

// ── PATCH updates mock state — DEV in-memory flow ────────────────────────────

describe('updateTelegramLink mock state persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValue(new (ApiError as any)(404))
    mockPatch.mockRejectedValue(new (ApiError as any)(404))
  })

  afterEach(() => {
    ;(global as any).__DEV__ = false
  })

  it('GET after PATCH reflects updated preferredMessenger', async () => {
    await updateTelegramLink({ preferredMessenger: 'whatsapp' })
    const link = await fetchMyTelegramLink()
    expect(link.preferredMessenger).toBe('whatsapp')
  })

  it('changing username resets verification in mock state', async () => {
    // First confirm to set verified=true in mock
    mockPost.mockRejectedValue(new (ApiError as any)(404))
    await confirmTelegramAuth('tok')
    // Change username — should reset verified
    await updateTelegramLink({ telegramUsername: 'brandnewuser' })
    const link = await fetchMyTelegramLink()
    expect(link.telegramVerified).toBe(false)
  })
})
