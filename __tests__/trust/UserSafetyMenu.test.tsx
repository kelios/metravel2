// __tests__/trust/UserSafetyMenu.test.tsx
// Trust & Safety (Sprint 16, FE-430/FE-434): flow жалобы (открыть меню → выбрать
// причину → отправить) и блокировки (кнопка вызывает blockUser и переключает label).

import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean; userId: string }) => unknown) =>
    selector({ isAuthenticated: true, userId: '1' }),
}))

jest.mock('@/api/userSafety', () => ({
  __esModule: true,
  reportUser: jest.fn(() => Promise.resolve({ id: 1, status: 'pending' })),
  blockUser: jest.fn(() => Promise.resolve()),
  unblockUser: jest.fn(() => Promise.resolve()),
  fetchReportReasons: jest.fn(() =>
    Promise.resolve([
      { key: 'spam', label: 'Спам' },
      { key: 'harassment', label: 'Оскорбления' },
    ]),
  ),
  fetchBlockedUsers: jest.fn(() => Promise.resolve([])),
  isMockReported: jest.fn(() => false),
  isMockBlocked: jest.fn(() => false),
}))

import UserSafetyMenu from '@/components/profile/UserSafetyMenu'
import { reportUser, blockUser } from '@/api/userSafety'

const mockedReportUser = reportUser as jest.Mock
const mockedBlockUser = blockUser as jest.Mock

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('UserSafetyMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the trigger for an authenticated viewer', () => {
    const { getByTestId } = render(
      <UserSafetyMenu targetUserId={42} targetName="Иван" />,
      { wrapper: createWrapper() },
    )
    expect(getByTestId('user-safety-menu')).toBeTruthy()
  })

  it('completes the report flow: open → choose reason → submit', async () => {
    const { getByTestId, findByTestId } = render(
      <UserSafetyMenu targetUserId={42} targetName="Иван" />,
      { wrapper: createWrapper() },
    )

    fireEvent.press(getByTestId('user-safety-menu'))
    fireEvent.press(getByTestId('user-safety-report'))

    // Reason list resolves from the (mocked) reasons query.
    const spamReason = await findByTestId('report-reason-spam')
    fireEvent.press(spamReason)
    fireEvent.press(getByTestId('report-submit'))

    await waitFor(() => {
      expect(mockedReportUser).toHaveBeenCalled()
    })
    expect(mockedReportUser.mock.calls[0][0]).toEqual({
      userId: 42,
      reason: 'spam',
      comment: '',
    })
  })

  it('blocks the user and switches the action to "Разблокировать"', async () => {
    const { getByTestId, findByText } = render(
      <UserSafetyMenu targetUserId={42} targetName="Иван" />,
      { wrapper: createWrapper() },
    )

    fireEvent.press(getByTestId('user-safety-menu'))
    fireEvent.press(getByTestId('user-safety-block'))

    await waitFor(() => {
      expect(mockedBlockUser).toHaveBeenCalled()
    })
    expect(mockedBlockUser.mock.calls[0][0]).toBe(42)

    // Re-open the menu — the action now reads "Разблокировать".
    fireEvent.press(getByTestId('user-safety-menu'))
    expect(await findByText('Разблокировать')).toBeTruthy()
  })
})
