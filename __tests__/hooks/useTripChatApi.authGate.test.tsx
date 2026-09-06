// #1829: у `useTripChatMessages` не было авторизационного гейта — только
// `threadId != null`. Живой `threadId`, оставшийся в памяти от предыдущего
// пользователя, отрисовывал тела сообщений чужой поездки следующему вошедшему
// или гостю. Гейт обязан совпадать с соседним `useTripChat`.

import React from 'react'
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

jest.mock('@/api/tripChat', () => ({
  fetchTripChat: jest.fn(async () => ({ id: 1, can_post: true })),
  fetchTripChatMessages: jest.fn(async () => [{ id: 1, text: 'secret' }]),
  markTripChatRead: jest.fn(async () => ({})),
  sendTripMessage: jest.fn(async () => ({ id: 2, text: 'sent' })),
}))

// #1831: ключ сообщений треда несёт владельца. Авторизованный без `userId`
// собрал бы ключ с `undefined` — состояние, которого в сторе не бывает.
const authRef = { isAuthenticated: false, userId: null as string | null }
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: typeof authRef) => unknown) => selector(authRef),
}))

import { useTripChat, useTripChatMessages } from '@/hooks/useTripChatApi'
import { fetchTripChat, fetchTripChatMessages } from '@/api/tripChat'

const mockMessages = fetchTripChatMessages as jest.MockedFunction<typeof fetchTripChatMessages>
const mockThread = fetchTripChat as jest.MockedFunction<typeof fetchTripChat>

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
)

beforeEach(() => {
  jest.clearAllMocks()
  authRef.isAuthenticated = false
  authRef.userId = null
})

describe('useTripChatMessages auth gate (#1829)', () => {
  it('гость с живым threadId не получает сообщения', async () => {
    const { result } = renderHook(() => useTripChatMessages(7), { wrapper })

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'))
    expect(mockMessages).not.toHaveBeenCalled()
    expect(result.current.data).toBeUndefined()
  })

  it('вошедший пользователь сообщения получает', async () => {
    authRef.isAuthenticated = true
    authRef.userId = '7'
    const { result } = renderHook(() => useTripChatMessages(7), { wrapper })

    await waitFor(() => expect(result.current.data).toEqual([{ id: 1, text: 'secret' }]))
    expect(mockMessages).toHaveBeenCalledWith(7)
  })

  // Гейт списка сообщений обязан совпадать с гейтом самого треда: иначе один из
  // двух снова окажется открытым.
  it('гейт совпадает с useTripChat на той же паре состояний', async () => {
    const guest = renderHook(() => useTripChat(7), { wrapper })
    await waitFor(() => expect(guest.result.current.fetchStatus).toBe('idle'))
    expect(mockThread).not.toHaveBeenCalled()

    authRef.isAuthenticated = true
    authRef.userId = '7'
    const signedIn = renderHook(() => useTripChat(7), { wrapper })
    await waitFor(() => expect(signedIn.result.current.data).toBeTruthy())
    expect(mockThread).toHaveBeenCalledWith(7)
  })
})
