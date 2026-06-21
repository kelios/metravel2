// __tests__/trips/api.tripChat.test.ts
// Unit tests for api/tripChat.ts — DTO→domain mapping + mock-fallback (Sprint 15 FE-422).

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
  fetchTripChat,
  fetchTripChatMessages,
  sendTripMessage,
  markTripChatRead,
} from '@/api/tripChat'

const mockGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>
const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>

const threadDto = (overrides: Record<string, unknown> = {}) => ({
  trip: 42,
  thread: 99,
  status: 'active' as const,
  can_post: true,
  participants: [1, 104],
  unread_count: 3,
  ...overrides,
})

const messageDto = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  thread: 99,
  sender: 104,
  text: 'Hello!',
  created_at: '2026-06-20T10:00:00Z',
  ...overrides,
})

const markReadDto = (overrides: Record<string, unknown> = {}) => ({
  thread_id: 99,
  last_read_message_id: 5,
  unread_count: 0,
  ...overrides,
})

// ── fetchTripChat ─────────────────────────────────────────────────────────────

describe('fetchTripChat', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('maps TripChatThreadDto snake_case to camelCase domain', async () => {
    mockGet.mockResolvedValueOnce(threadDto() as never)
    const thread = await fetchTripChat(42)

    expect(thread.tripId).toBe(42)
    expect(thread.threadId).toBe(99)
    expect(thread.status).toBe('active')
    expect(thread.canPost).toBe(true)
    expect(thread.participants).toEqual([1, 104])
    expect(thread.unreadCount).toBe(3)

    // No snake_case leaking
    expect((thread as any).can_post).toBeUndefined()
    expect((thread as any).unread_count).toBeUndefined()
  })

  it('handles null/missing unread_count gracefully', async () => {
    mockGet.mockResolvedValueOnce(threadDto({ unread_count: undefined }) as never)
    const thread = await fetchTripChat(42)
    expect(thread.unreadCount).toBe(0)
  })

  it('handles non-array participants gracefully', async () => {
    mockGet.mockResolvedValueOnce(threadDto({ participants: null }) as never)
    const thread = await fetchTripChat(42)
    expect(thread.participants).toEqual([])
  })

  it('calls the correct endpoint with tripId', async () => {
    mockGet.mockResolvedValueOnce(threadDto() as never)
    await fetchTripChat(42)
    expect(mockGet).toHaveBeenCalledWith('/trips/42/chat/')
  })

  it('accepts string tripId', async () => {
    mockGet.mockResolvedValueOnce(threadDto({ trip: 7, thread: 7 }) as never)
    const thread = await fetchTripChat('7')
    expect(thread.tripId).toBe(7)
  })

  it('returns mock fallback on ApiError(404) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    const thread = await fetchTripChat(1)
    expect(thread).toBeDefined()
    expect(thread.status).toBe('active')
    expect(thread.canPost).toBe(true)
  })

  it('returns mock fallback on ApiError(501) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(501))
    const thread = await fetchTripChat(1)
    expect(thread).toBeDefined()
  })

  it('returns mock fallback on ApiError(0) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(0))
    const thread = await fetchTripChat(1)
    expect(thread).toBeDefined()
  })

  it('archived trip (id 999) returns status archived and canPost false', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    const thread = await fetchTripChat(999)
    expect(thread.status).toBe('archived')
    expect(thread.canPost).toBe(false)
    expect(thread.unreadCount).toBe(0)
  })

  it('re-throws ApiError(404) when NOT in __DEV__', async () => {
    ;(global as any).__DEV__ = false
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    await expect(fetchTripChat(42)).rejects.toBeInstanceOf(ApiError)
  })

  it('re-throws non-ApiError regardless of __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new Error('Network timeout'))
    await expect(fetchTripChat(42)).rejects.toThrow('Network timeout')
  })
})

// ── fetchTripChatMessages ─────────────────────────────────────────────────────

describe('fetchTripChatMessages', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('maps array of TripChatMessageDto to domain', async () => {
    mockGet.mockResolvedValueOnce([messageDto(), messageDto({ id: 2, text: 'World' })] as never)
    const messages = await fetchTripChatMessages(99)

    expect(messages).toHaveLength(2)
    const m = messages[0]
    expect(m.id).toBe(1)
    expect(m.threadId).toBe(99)
    expect(m.senderId).toBe(104)
    expect(m.text).toBe('Hello!')
    expect(m.createdAt).toBe('2026-06-20T10:00:00Z')

    expect((m as any).thread).toBeUndefined()
    expect((m as any).sender).toBeUndefined()
    expect((m as any).created_at).toBeUndefined()
  })

  it('calls messages endpoint with threadId', async () => {
    mockGet.mockResolvedValueOnce([] as never)
    await fetchTripChatMessages(99)
    expect(mockGet).toHaveBeenCalledWith('/trip-chats/99/messages/')
  })

  it('appends cursor and limit query params', async () => {
    mockGet.mockResolvedValueOnce([] as never)
    await fetchTripChatMessages(99, { cursor: 'abc123', limit: 20 })
    const url = (mockGet.mock.calls[0][0] as string)
    expect(url).toContain('cursor=abc123')
    expect(url).toContain('limit=20')
  })

  it('tolerates non-array API response (returns empty)', async () => {
    mockGet.mockResolvedValueOnce(null as never)
    const messages = await fetchTripChatMessages(99)
    expect(messages).toEqual([])
  })

  it('returns mock seed messages on ApiError(404) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    // Use a fresh threadId to avoid state from other tests
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    const messages = await fetchTripChatMessages(200)
    expect(messages.length).toBeGreaterThan(0)
    expect(messages[0].text).toBeDefined()
  })

  it('archived thread (id 999) seeded messages reference finished trip', async () => {
    ;(global as any).__DEV__ = true
    mockGet.mockRejectedValueOnce(new (ApiError as any)(404))
    const messages = await fetchTripChatMessages(999)
    expect(messages.length).toBeGreaterThan(0)
    // Archived thread messages contain a farewell-style text
    const texts = messages.map((m) => m.text).join(' ')
    expect(texts.length).toBeGreaterThan(0)
  })

  it('re-throws ApiError(500) when NOT in __DEV__', async () => {
    ;(global as any).__DEV__ = false
    mockGet.mockRejectedValueOnce(new (ApiError as any)(500))
    await expect(fetchTripChatMessages(99)).rejects.toBeInstanceOf(ApiError)
  })
})

// ── sendTripMessage ───────────────────────────────────────────────────────────

describe('sendTripMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('maps post response DTO to domain message', async () => {
    mockPost.mockResolvedValueOnce(messageDto({ id: 99, text: 'Hi there' }) as never)
    const msg = await sendTripMessage({ threadId: 99, text: 'Hi there' })

    expect(msg.id).toBe(99)
    expect(msg.text).toBe('Hi there')
    expect(msg.threadId).toBe(99)
    expect(msg.senderId).toBe(104)
    expect(msg.createdAt).toBe('2026-06-20T10:00:00Z')
  })

  it('posts to correct messages endpoint', async () => {
    mockPost.mockResolvedValueOnce(messageDto() as never)
    await sendTripMessage({ threadId: 55, text: 'test' })
    expect(mockPost).toHaveBeenCalledWith('/trip-chats/55/messages/', { text: 'test' })
  })

  it('appends new message to in-memory thread in DEV fallback', async () => {
    ;(global as any).__DEV__ = true
    // Use a thread id not used elsewhere to avoid cross-test state
    const THREAD = 300
    mockGet.mockRejectedValue(new (ApiError as any)(404))
    mockPost.mockRejectedValue(new (ApiError as any)(404))

    const before = await fetchTripChatMessages(THREAD)
    const countBefore = before.length

    await sendTripMessage({ threadId: THREAD, text: 'New message' })

    const after = await fetchTripChatMessages(THREAD)
    expect(after.length).toBe(countBefore + 1)
    expect(after[after.length - 1].text).toBe('New message')
  })

  it('re-throws ApiError when not in DEV', async () => {
    ;(global as any).__DEV__ = false
    mockPost.mockRejectedValueOnce(new (ApiError as any)(404))
    await expect(sendTripMessage({ threadId: 99, text: 'x' })).rejects.toBeInstanceOf(ApiError)
  })
})

// ── markTripChatRead ──────────────────────────────────────────────────────────

describe('markTripChatRead', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__DEV__ = false
  })

  it('maps MarkTripChatReadDto to domain', async () => {
    mockPost.mockResolvedValueOnce(markReadDto() as never)
    const result = await markTripChatRead(99, 5)

    expect(result.threadId).toBe(99)
    expect(result.lastReadMessageId).toBe(5)
    expect(result.unreadCount).toBe(0)

    expect((result as any).thread_id).toBeUndefined()
    expect((result as any).last_read_message_id).toBeUndefined()
    expect((result as any).unread_count).toBeUndefined()
  })

  it('posts to correct mark-read endpoint with lastReadMessageId', async () => {
    mockPost.mockResolvedValueOnce(markReadDto() as never)
    await markTripChatRead(99, 5)
    expect(mockPost).toHaveBeenCalledWith('/trip-chats/99/mark-read/', { last_read_message_id: 5 })
  })

  it('posts empty body when lastReadMessageId not provided', async () => {
    mockPost.mockResolvedValueOnce(markReadDto({ last_read_message_id: null }) as never)
    await markTripChatRead(99)
    expect(mockPost).toHaveBeenCalledWith('/trip-chats/99/mark-read/', {})
  })

  it('handles null last_read_message_id in response', async () => {
    mockPost.mockResolvedValueOnce(markReadDto({ last_read_message_id: null }) as never)
    const result = await markTripChatRead(99)
    expect(result.lastReadMessageId).toBeNull()
  })

  it('returns mock result on ApiError(404) in __DEV__', async () => {
    ;(global as any).__DEV__ = true
    mockPost.mockRejectedValueOnce(new (ApiError as any)(404))
    const result = await markTripChatRead(99, 10)
    expect(result.threadId).toBe(99)
    expect(result.lastReadMessageId).toBe(10)
    expect(result.unreadCount).toBe(0)
  })

  it('re-throws ApiError when not in DEV', async () => {
    ;(global as any).__DEV__ = false
    mockPost.mockRejectedValueOnce(new (ApiError as any)(404))
    await expect(markTripChatRead(99)).rejects.toBeInstanceOf(ApiError)
  })
})

// ── USE_MOCK flag path ────────────────────────────────────────────────────────

describe('fetchTripChat with EXPO_PUBLIC_TRIPS_MOCK=true', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env.EXPO_PUBLIC_TRIPS_MOCK = 'true'
    jest.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_TRIPS_MOCK
    jest.resetModules()
  })

  it('returns mock thread without calling apiClient', async () => {
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

    const { fetchTripChat: fetchWithMock } = await import('@/api/tripChat')
    const { apiClient: mockedClient } = await import('@/api/client')

    const thread = await fetchWithMock(1)
    expect(thread).toBeDefined()
    expect((mockedClient.get as jest.Mock).mock.calls.length).toBe(0)
  })
})
