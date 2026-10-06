import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

let mockAuth = { authReady: false, isAuthenticated: false, userId: null as string | null }
jest.mock('@/stores/authStore', () => ({ useAuthStore: (selector: (state: typeof mockAuth) => unknown) => selector(mockAuth) }))
jest.mock('@/hooks/useQueryOwner', () => ({ useQueryOwner: () => mockAuth.isAuthenticated ? mockAuth.userId : null }))
jest.mock('@/api/userSafety', () => ({ fetchBlockedUsers: jest.fn(async () => []), blockUser: jest.fn(), unblockUser: jest.fn(), fetchReportReasons: jest.fn(), reportContent: jest.fn() }))
jest.mock('@/utils/toast', () => ({ showToast: jest.fn() }))
import { useBlockedUsers } from '@/hooks/useUserSafety'
import { fetchBlockedUsers } from '@/api/userSafety'

it('sends zero protected requests until auth is ready with an owner; resumes normally and preserves errors', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  mockAuth = { authReady: false, isAuthenticated: false, userId: null }
  const hook = renderHook(() => useBlockedUsers(), { wrapper })
  await act(async () => {})
  expect(fetchBlockedUsers).not.toHaveBeenCalled()
  mockAuth = { authReady: true, isAuthenticated: false, userId: null }
  hook.rerender({})
  await act(async () => {})
  expect(fetchBlockedUsers).not.toHaveBeenCalled()
  mockAuth = { authReady: false, isAuthenticated: true, userId: '104' }
  hook.rerender({})
  await act(async () => {})
  expect(fetchBlockedUsers).not.toHaveBeenCalled()
  mockAuth = { authReady: true, isAuthenticated: true, userId: '104' }
  hook.rerender({})
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true))
  expect(fetchBlockedUsers).toHaveBeenCalledTimes(1)
  const { ApiError } = require('@/api/client')
  const error = new ApiError(403, 'request failed')
  ;(fetchBlockedUsers as jest.Mock).mockRejectedValueOnce(error)
  await act(async () => { await hook.result.current.refetch() })
  await waitFor(() => expect(hook.result.current.error).toBe(error))
  hook.unmount()
  client.clear()
})
