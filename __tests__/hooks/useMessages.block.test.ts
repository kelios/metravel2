// #2134: переписка с заблокированным скрывается сразу и после перечитывания,
// разблокировка перечитывает списки.
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient } from '@tanstack/react-query'

jest.mock('@/api/messages', () => ({
  fetchMessageThreads: jest.fn(),
  fetchMessages: jest.fn(),
  fetchThreadByUser: jest.fn(),
  fetchAvailableUsers: jest.fn(),
  sendMessage: jest.fn(),
  deleteMessage: jest.fn(),
  deleteThread: jest.fn(),
  markThreadRead: jest.fn(),
}))

import { useThreadMessages, useThreads } from '@/hooks/useMessages'
import { fetchMessageThreads, fetchMessages } from '@/api/messages'
import {
  applyAuthorBlock,
  installBlockedAuthorGuard,
  notifyAuthorUnblocked,
  releaseAuthorBlock,
  resetBlockedAuthorStateForTests,
} from '@/api/blockSensitiveQueries'

const BLOCKED = 7
const threads = [
  { id: 1, participants: [1, BLOCKED], created_at: null, last_message_created_at: null, unread_count: 0 },
  { id: 2, participants: [1, 3], created_at: null, last_message_created_at: null, unread_count: 0 },
]
const messages = [
  { id: 10, thread: 1, sender: BLOCKED, text: 'a', created_at: '2026-10-01T10:00:00Z' },
  { id: 11, thread: 1, sender: 1, text: 'b', created_at: '2026-10-01T10:01:00Z' },
]

let qc: QueryClient
let stopGuard: () => void

beforeEach(() => {
  jest.clearAllMocks()
  resetBlockedAuthorStateForTests()
  qc = new QueryClient()
  stopGuard = installBlockedAuthorGuard(qc, { getOwner: () => '1' })
  ;(fetchMessageThreads as jest.Mock).mockResolvedValue(threads)
  ;(fetchMessages as jest.Mock).mockResolvedValue({ results: messages, next: null })
})

afterEach(() => stopGuard())

describe('useThreads', () => {
  it('hides the blocked conversation at once and reloads on unblock', async () => {
    const { result } = renderHook(() => useThreads(true, false))
    await waitFor(() => expect(result.current.threads).toHaveLength(2))

    act(() => applyAuthorBlock(qc, BLOCKED))
    expect(result.current.threads.map((t) => t.id)).toEqual([2])

    // Перечитывание при живом блоке не возвращает переписку.
    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.threads.map((t) => t.id)).toEqual([2])

    releaseAuthorBlock(BLOCKED, false)
    await act(async () => notifyAuthorUnblocked(BLOCKED))
    await waitFor(() => expect(result.current.threads).toHaveLength(2))
  })
})

describe('useThreadMessages', () => {
  it('drops messages of the blocked sender', async () => {
    const { result } = renderHook(() => useThreadMessages(1, false))
    await waitFor(() => expect(result.current.messages).toHaveLength(2))

    act(() => applyAuthorBlock(qc, BLOCKED))
    expect(result.current.messages.map((m) => m.id)).toEqual([11])
  })
})
