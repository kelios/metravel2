// __tests__/trust/UserSafetyMenu.test.tsx
// Trust & Safety (Sprint 16, FE-430/FE-434): flow жалобы (открыть меню → выбрать
// причину → отправить) и блокировки (кнопка вызывает blockUser и переключает label).

import React from 'react'
import { Modal, Platform } from 'react-native'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean; userId: string }) => unknown) =>
    selector({ isAuthenticated: true, userId: '1' }),
}))

jest.mock('@/api/userSafety', () => ({
  __esModule: true,
  reportContent: jest.fn(() => Promise.resolve({ id: 1, due_at: '2026-10-05T10:00:00Z' })),
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

jest.mock('@/utils/confirmAction', () => ({
  confirmAction: jest.fn(() => Promise.resolve(true)),
}))

import UserSafetyMenu from '@/components/profile/UserSafetyMenu'
import { reportContent, blockUser } from '@/api/userSafety'
import { confirmAction } from '@/utils/confirmAction'

const mockedReportContent = reportContent as jest.Mock
const mockedBlockUser = blockUser as jest.Mock
const mockedConfirm = confirmAction as jest.Mock

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
      expect(mockedReportContent).toHaveBeenCalled()
    })
    expect(mockedReportContent.mock.calls[0][0]).toEqual({
      target: { content_type: 'user', object_id: 42, author_id: 42 },
      reason: 'spam',
      comment: '',
    })
  })

  describe('block confirmation (#2134)', () => {
    const originalOS = Platform.OS
    afterEach(() => {
      Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true })
    })

    it('asks for confirmation after the sheet closes and blocks on confirm', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true })
      const { getByTestId, findByText } = render(
        <UserSafetyMenu targetUserId={42} targetName="Иван" />,
        { wrapper: createWrapper() },
      )

      fireEvent.press(getByTestId('user-safety-menu'))
      fireEvent.press(getByTestId('user-safety-block'))

      await waitFor(() => expect(mockedConfirm).toHaveBeenCalledTimes(1))
      const dialog = mockedConfirm.mock.calls[0][0]
      expect(dialog.title).toContain('Иван')
      expect(dialog.message).toMatch(/уведомление/)
      await waitFor(() => expect(mockedBlockUser).toHaveBeenCalled())
      expect(mockedBlockUser.mock.calls[0][0]).toBe(42)

      fireEvent.press(getByTestId('user-safety-menu'))
      expect(await findByText('Разблокировать')).toBeTruthy()
    })

    it('does not block when the confirmation is cancelled', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true })
      mockedConfirm.mockResolvedValueOnce(false)
      const { getByTestId, findByText } = render(
        <UserSafetyMenu targetUserId={42} targetName="Иван" />,
        { wrapper: createWrapper() },
      )

      fireEvent.press(getByTestId('user-safety-menu'))
      fireEvent.press(getByTestId('user-safety-block'))

      await waitFor(() => expect(mockedConfirm).toHaveBeenCalledTimes(1))
      await act(async () => {})
      expect(mockedBlockUser).not.toHaveBeenCalled()
      fireEvent.press(getByTestId('user-safety-menu'))
      expect(await findByText('Заблокировать')).toBeTruthy()
    })

    it('on iOS waits for the sheet dismissal before showing the dialog', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true })
      const { getByTestId, UNSAFE_getAllByType } = render(
        <UserSafetyMenu targetUserId={42} targetName="Иван" />,
        { wrapper: createWrapper() },
      )

      fireEvent.press(getByTestId('user-safety-menu'))
      fireEvent.press(getByTestId('user-safety-block'))
      await act(async () => {})
      expect(mockedConfirm).not.toHaveBeenCalled()

      await act(async () => {
        UNSAFE_getAllByType(Modal)[0].props.onDismiss()
      })
      await waitFor(() => expect(mockedBlockUser).toHaveBeenCalled())
      expect(mockedConfirm).toHaveBeenCalledTimes(1)
    })
  })
})
