// #2134: список «Заблокированные» — пустое, ошибочное и непустое состояния;
// разблокировка только после подтверждения.
import React from 'react'
import { fireEvent, render, waitFor, act } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

jest.mock('@/hooks/useQueryOwner', () => ({ useQueryOwner: () => '1' }))
jest.mock('@/stores/authStore', () => ({ useAuthStore: (selector: (state: { authReady: boolean }) => unknown) => selector({ authReady: true }) }))
jest.mock('@/utils/toast', () => ({ showToast: jest.fn() }))
jest.mock('@/utils/confirmAction', () => ({ confirmAction: jest.fn(() => Promise.resolve(true)) }))
jest.mock('@/api/userSafety', () => ({
  __esModule: true,
  blockUser: jest.fn(),
  unblockUser: jest.fn(() => Promise.resolve()),
  reportContent: jest.fn(),
  fetchReportReasons: jest.fn(() => Promise.resolve([])),
  fetchBlockedUsers: jest.fn(),
}))

import BlockedUsersList from '@/components/settings/BlockedUsersList'
import { fetchBlockedUsers, unblockUser } from '@/api/userSafety'
import { confirmAction } from '@/utils/confirmAction'
import { resetBlockedAuthorStateForTests } from '@/api/blockSensitiveQueries'

const renderList = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <BlockedUsersList />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  resetBlockedAuthorStateForTests()
})

describe('BlockedUsersList', () => {
  it('shows the empty state when nobody is blocked', async () => {
    ;(fetchBlockedUsers as jest.Mock).mockResolvedValue([])
    const { findByTestId } = renderList()
    expect(await findByTestId('blocked-users-empty')).toBeTruthy()
  })

  it('shows a retryable error state', async () => {
    // 403 хук не ретраит (`useUserSafety` retry) — состояние ошибки сразу.
    const { ApiError } = jest.requireActual('@/api/client')
    ;(fetchBlockedUsers as jest.Mock).mockRejectedValue(new ApiError(403, 'forbidden'))
    const { findByTestId } = renderList()
    expect(await findByTestId('blocked-users-error')).toBeTruthy()
  })

  it('lists blocked users by their `user` id and unblocks after confirmation', async () => {
    ;(fetchBlockedUsers as jest.Mock)
      .mockResolvedValueOnce([{ id: 500, user: 7, first_name: 'Иван', last_name: 'Петров', avatar: null }])
      .mockResolvedValue([])
    const { findByTestId, getByText, queryByTestId } = renderList()
    expect(await findByTestId('blocked-user-7')).toBeTruthy()
    expect(getByText('Иван Петров')).toBeTruthy()

    ;(confirmAction as jest.Mock).mockResolvedValueOnce(false)
    await act(async () => {
      fireEvent.press(getByText('Разблокировать'))
    })
    expect(unblockUser).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.press(getByText('Разблокировать'))
    })
    await waitFor(() => expect(unblockUser).toHaveBeenCalledWith(7, expect.anything()))
    expect((confirmAction as jest.Mock).mock.calls[1][0].title).toContain('Иван Петров')
    await waitFor(() => expect(queryByTestId('blocked-user-7')).toBeNull())
  })
})
