// #2133 (Apple 1.2(c)): жалоба на сообщение в чате поездки.

import React from 'react'
import { render as rtlRender } from '@testing-library/react-native'

import { createQueryWrapper } from '../../helpers/testQueryClient'

jest.mock('@/stores/authStore', () => require('../../helpers/contentSafetyMocks').authStoreMock)
jest.mock('@/api/userSafety', () => require('../../helpers/contentSafetyMocks').userSafetyApiMock)
jest.mock('@/utils/toast', () => ({ showToast: jest.fn(() => Promise.resolve()) }))
jest.mock('@/api/tripChat', () => ({
  ...jest.requireActual('@/api/tripChat'),
  fetchTripChat: jest.fn(() =>
    Promise.resolve({ tripId: 3, threadId: 9, status: 'active', canPost: true, participants: [1, 42], unreadCount: 0 }),
  ),
  fetchTripChatMessages: jest.fn(() =>
    Promise.resolve([
      { id: 5, threadId: 9, senderId: 42, text: 'Чужое в поездке', createdAt: '2026-10-01T10:00:00Z' },
      { id: 6, threadId: 9, senderId: 1, text: 'Моё в поездке', createdAt: '2026-10-01T10:05:00Z' },
    ]),
  ),
}))

import { TripChatPanel } from '@/components/trips/chat/TripChatPanel'
import { useHiddenContentStore } from '@/stores/hiddenContentStore'

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: createQueryWrapper().Wrapper })

beforeEach(() => {
  useHiddenContentStore.setState({ byOwner: {} })
})

describe('TripChatPanel safety (#2133)', () => {
  it('shows the trigger on a foreign message only', async () => {
    const { findByText, getByTestId, queryByTestId } = render(<TripChatPanel tripId={3} />)
    await findByText('Чужое в поездке')
    expect(getByTestId('trip-chat-message-5-safety-menu')).toBeTruthy()
    expect(queryByTestId('trip-chat-message-6-safety-menu')).toBeNull()
  })

  it('replaces a hidden foreign message with the placeholder', async () => {
    useHiddenContentStore.setState({ byOwner: { '1': ['trip_chat_message:5'] } })
    const { findByText, getByTestId, queryByText } = render(<TripChatPanel tripId={3} />)
    await findByText('Моё в поездке')
    expect(getByTestId('hidden-content')).toBeTruthy()
    expect(queryByText('Чужое в поездке')).toBeNull()
  })
})
