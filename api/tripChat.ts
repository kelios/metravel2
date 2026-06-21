// api/tripChat.ts
// Слой чата участников поездки (Sprint 15 / блок 6, тикеты #418/#422).
// Контракт (BE ещё не задеплоен):
//   thread/статус   GET  /api/trips/{trip_id}/chat/
//   сообщения       GET  /api/trip-chats/{thread_id}/messages/?cursor={cursor}&limit={n}
//   отправить       POST /api/trip-chats/{thread_id}/messages/   { text }
//   пометить чит.   POST /api/trip-chats/{thread_id}/mark-read/  { last_read_message_id? }
// Когда поездка completed → chat отдаёт status="archived", can_post=false, POST → 403.
// До верификации BE на проде сохранён мок-фолбэк (EXPO_PUBLIC_TRIPS_MOCK=true или 0/404/501 в DEV).

import { apiClient, ApiError } from '@/api/client'
import { devWarn } from '@/utils/logger'

// ── Доменные типы (camelCase) ──────────────────────────────────────────────

/** Статус чата поездки. archived ⇒ только чтение. */
export type TripChatStatus = 'planned' | 'active' | 'archived'

export interface TripChatThread {
  tripId: number
  threadId: number
  status: TripChatStatus
  canPost: boolean
  participants: number[]
  unreadCount: number
}

export interface TripChatMessage {
  id: number
  threadId: number
  senderId: number
  text: string
  createdAt: string
}

export interface MarkTripChatReadResult {
  threadId: number
  lastReadMessageId: number | null
  unreadCount: number
}

export interface SendTripMessageInput {
  threadId: number
  text: string
}

// ── DTO (snake_case с бэка) ─────────────────────────────────────────────────

interface TripChatThreadDto {
  trip: number
  thread: number
  status: TripChatStatus
  can_post: boolean
  participants: number[]
  unread_count: number
}

interface TripChatMessageDto {
  id: number
  thread: number
  sender: number
  text: string
  created_at: string
}

interface MarkTripChatReadDto {
  thread_id: number
  last_read_message_id: number | null
  unread_count: number
}

// ── Маппинг ─────────────────────────────────────────────────────────────────

const mapThread = (dto: TripChatThreadDto): TripChatThread => ({
  tripId: dto.trip,
  threadId: dto.thread,
  status: dto.status,
  canPost: dto.can_post,
  participants: Array.isArray(dto.participants) ? dto.participants : [],
  unreadCount: dto.unread_count ?? 0,
})

const mapMessage = (dto: TripChatMessageDto): TripChatMessage => ({
  id: dto.id,
  threadId: dto.thread,
  senderId: dto.sender,
  text: dto.text,
  createdAt: dto.created_at,
})

const mapMarkRead = (dto: MarkTripChatReadDto): MarkTripChatReadResult => ({
  threadId: dto.thread_id,
  lastReadMessageId: dto.last_read_message_id ?? null,
  unreadCount: dto.unread_count ?? 0,
})

// ── Мок-фолбэк (FE-guard: снять после верификации BE на проде + regression) ──

const USE_MOCK = process.env.EXPO_PUBLIC_TRIPS_MOCK === 'true'

/** Бэкенд недоступен → 0/404/501. В DEV или под флагом отдаём мок. */
const shouldFallbackToMock = (error: unknown): boolean => {
  if (USE_MOCK) return true
  if (!__DEV__) return false
  return error instanceof ApiError && [0, 404, 501].includes(error.status)
}

// Мок-thread: для одной поездки — активный чат, для другой (id 999) — архив.
const ARCHIVED_MOCK_TRIP_ID = 999

const mockThread = (tripId: number): TripChatThread => {
  const archived = tripId === ARCHIVED_MOCK_TRIP_ID
  return {
    tripId,
    threadId: tripId,
    status: archived ? 'archived' : 'active',
    canPost: !archived,
    participants: [1, 104],
    unreadCount: archived ? 0 : 1,
  }
}

// In-memory сообщения по threadId, чтобы отправка визуально дописывала список.
const MOCK_MESSAGES: Record<number, TripChatMessage[]> = {}
let mockMessageId = 1000

const seedMockMessages = (threadId: number): TripChatMessage[] => {
  if (MOCK_MESSAGES[threadId]) return MOCK_MESSAGES[threadId]
  const archived = threadId === ARCHIVED_MOCK_TRIP_ID
  const base = Date.now() - 1000 * 60 * 60 * 24
  MOCK_MESSAGES[threadId] = [
    {
      id: mockMessageId++,
      threadId,
      senderId: 104,
      text: archived
        ? 'Спасибо всем за поездку, было здорово!'
        : 'Привет! Когда выезжаем в субботу?',
      createdAt: new Date(base).toISOString(),
    },
    {
      id: mockMessageId++,
      threadId,
      senderId: 1,
      text: archived
        ? 'Да, отличный маршрут получился.'
        : 'В 8 утра от вокзала, не опаздывайте :)',
      createdAt: new Date(base + 1000 * 60 * 5).toISOString(),
    },
  ]
  return MOCK_MESSAGES[threadId]
}

// ── Публичные fetch-функции ─────────────────────────────────────────────────

export async function fetchTripChat(tripId: number | string): Promise<TripChatThread> {
  const tripIdNum = Number(tripId)
  if (USE_MOCK) return mockThread(tripIdNum)
  try {
    const dto = await apiClient.get<TripChatThreadDto>(`/trips/${tripId}/chat/`)
    return mapThread(dto)
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[trip-chat] thread → mock fallback')
      return mockThread(tripIdNum)
    }
    throw error
  }
}

export async function fetchTripChatMessages(
  threadId: number | string,
  options?: { cursor?: string; limit?: number },
): Promise<TripChatMessage[]> {
  const threadIdNum = Number(threadId)
  if (USE_MOCK) return seedMockMessages(threadIdNum)
  const params = new URLSearchParams()
  if (options?.cursor) params.set('cursor', options.cursor)
  if (options?.limit != null) params.set('limit', String(options.limit))
  const query = params.toString()
  try {
    const dto = await apiClient.get<TripChatMessageDto[]>(
      `/trip-chats/${threadId}/messages/${query ? `?${query}` : ''}`,
    )
    return (Array.isArray(dto) ? dto : []).map(mapMessage)
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[trip-chat] messages → mock fallback')
      return seedMockMessages(threadIdNum)
    }
    throw error
  }
}

// ── Мутации ─────────────────────────────────────────────────────────────────

export async function sendTripMessage(
  input: SendTripMessageInput,
): Promise<TripChatMessage> {
  const threadIdNum = Number(input.threadId)
  const mockResult = (): TripChatMessage => {
    const msg: TripChatMessage = {
      id: mockMessageId++,
      threadId: threadIdNum,
      senderId: 1,
      text: input.text,
      createdAt: new Date().toISOString(),
    }
    seedMockMessages(threadIdNum).push(msg)
    return msg
  }
  if (USE_MOCK) return mockResult()
  try {
    const dto = await apiClient.post<TripChatMessageDto>(
      `/trip-chats/${input.threadId}/messages/`,
      { text: input.text },
    )
    return mapMessage(dto)
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[trip-chat] send → mock fallback')
      return mockResult()
    }
    throw error
  }
}

export async function markTripChatRead(
  threadId: number | string,
  lastReadMessageId?: number,
): Promise<MarkTripChatReadResult> {
  const threadIdNum = Number(threadId)
  const mockResult = (): MarkTripChatReadResult => ({
    threadId: threadIdNum,
    lastReadMessageId: lastReadMessageId ?? null,
    unreadCount: 0,
  })
  if (USE_MOCK) return mockResult()
  try {
    const dto = await apiClient.post<MarkTripChatReadDto>(
      `/trip-chats/${threadId}/mark-read/`,
      lastReadMessageId != null ? { last_read_message_id: lastReadMessageId } : {},
    )
    return mapMarkRead(dto)
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[trip-chat] mark-read → mock fallback')
      return mockResult()
    }
    throw error
  }
}
