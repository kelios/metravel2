// #2133 (Apple 1.2(c)): жалоба на личное сообщение и на собеседника в шапке чата.

import React from 'react'
import { act, fireEvent, render as rtlRender } from '@testing-library/react-native'

import { createQueryWrapper } from '../../helpers/testQueryClient'

jest.mock('@/stores/authStore', () => require('../../helpers/contentSafetyMocks').authStoreMock)
jest.mock('@/api/userSafety', () => require('../../helpers/contentSafetyMocks').userSafetyApiMock)
jest.mock('@/utils/toast', () => ({ showToast: jest.fn(() => Promise.resolve()) }))
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }))

let mockIsScreenHeaderMobile = false
jest.mock('@/components/layout/ScreenHeaderContext', () => ({
  ...jest.requireActual('@/components/layout/ScreenHeaderContext'),
  useIsScreenHeaderMobile: () => mockIsScreenHeaderMobile,
}))

import MessageBubble from '@/components/messages/MessageBubble'
import ChatView from '@/components/messages/ChatView'
import type { Message } from '@/api/messages'
import { useHiddenContentStore } from '@/stores/hiddenContentStore'

const render = async (ui: React.ReactElement) => rtlRender(ui, { wrapper: createQueryWrapper().Wrapper })

const foreign: Message = { id: 7, thread: 10, sender: 42, text: 'Чужое сообщение', created_at: '2026-10-01T10:00:00Z' }
const own: Message = { id: 8, thread: 10, sender: 1, text: 'Моё сообщение', created_at: '2026-10-01T10:05:00Z' }

const chatProps = {
  messages: [foreign, own],
  loading: false,
  sending: false,
  currentUserId: '1',
  otherUserName: 'Иван',
  otherUserId: 42,
  otherUserAvatar: null,
  onSend: jest.fn(),
  onBack: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
  mockIsScreenHeaderMobile = false
  useHiddenContentStore.setState({ byOwner: {} })
})

describe('MessageBubble safety (#2133)', () => {
  it('shows the «…» trigger on a foreign message', async () => {
    const { getByTestId } = await render(<MessageBubble message={foreign} isOwn={false} />)
    expect(getByTestId('message-7-safety-menu')).toBeTruthy()
  })

  it('does not show the trigger on an own message', async () => {
    const { queryByTestId } = await render(<MessageBubble message={own} isOwn />)
    expect(queryByTestId('message-8-safety-menu')).toBeNull()
  })

  it('offers report, hide and block of the sender', async () => {
    const { getByTestId } = await render(<MessageBubble message={foreign} isOwn={false} />)
    await fireEvent.press(getByTestId('message-7-safety-menu'))
    expect(getByTestId('message-7-safety-report')).toBeTruthy()
    expect(getByTestId('message-7-safety-hide')).toBeTruthy()
    expect(getByTestId('message-7-safety-block')).toBeTruthy()
  })

  it('replaces a hidden foreign message with the placeholder and shows it back', async () => {
    useHiddenContentStore.setState({ byOwner: { '1': ['message:7'] } })
    const { getByTestId, queryByText, getByText } = await render(<MessageBubble message={foreign} isOwn={false} />)
    expect(getByTestId('hidden-content')).toBeTruthy()
    expect(queryByText(/Чужое сообщение/)).toBeNull()
    await act(async () => {
      await fireEvent.press(getByTestId('hidden-content-show'))
    })
    expect(getByText(/Чужое сообщение/)).toBeTruthy()
  })
})

describe('ChatView safety (#2133)', () => {
  it('marks only foreign messages with the trigger', async () => {
    const { getByTestId, queryByTestId } = await render(<ChatView {...chatProps} />)
    expect(getByTestId('message-7-safety-menu')).toBeTruthy()
    expect(queryByTestId('message-8-safety-menu')).toBeNull()
  })

  it('phone: merges report/block of the interlocutor before the destructive delete', async () => {
    mockIsScreenHeaderMobile = true
    const { getByTestId, queryAllByTestId } = await render(<ChatView {...chatProps} onDeleteThread={jest.fn()} />)
    await fireEvent.press(getByTestId('chat-header-more'))
    const order = queryAllByTestId(/^chat-header-(safety-(report|hide|block)|delete-thread)$/).map(
      (node) => node.props.testID,
    )
    expect(order).toEqual(['chat-header-safety-report', 'chat-header-safety-block', 'chat-header-delete-thread'])
  })

  it('phone: shows «⋯» with the safety items even without thread deletion', async () => {
    mockIsScreenHeaderMobile = true
    const { getByTestId, queryByTestId } = await render(<ChatView {...chatProps} />)
    await fireEvent.press(getByTestId('chat-header-more'))
    expect(getByTestId('chat-header-safety-report')).toBeTruthy()
    expect(queryByTestId('chat-header-delete-thread')).toBeNull()
  })

  it('desktop: renders the safety trigger next to the delete button', async () => {
    const { getByTestId } = await render(<ChatView {...chatProps} onDeleteThread={jest.fn()} />)
    expect(getByTestId('chat-header-safety-menu')).toBeTruthy()
    expect(getByTestId('chat-header-delete')).toBeTruthy()
  })

  it('has no header safety actions without a known interlocutor', async () => {
    mockIsScreenHeaderMobile = true
    const { queryByTestId } = await render(<ChatView {...chatProps} otherUserId={null} />)
    expect(queryByTestId('chat-header-more')).toBeNull()
  })
})
