// #2133 (Apple 1.2(c)): жалоба на комментарий травела — «…» у чужого
// комментария, свой toggle правки у своего, плашка «Скрыто» у скрытого.

import React from 'react'
import { render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { CommentItem } from '@/components/travel/CommentItem'
import { useAuth } from '@/context/AuthContext'
import { useAuthStore } from '@/stores/authStore'
import { useHiddenContentStore } from '@/stores/hiddenContentStore'
import type { TravelComment } from '@/types/comments'

jest.mock('@/context/AuthContext')
jest.mock('@/hooks/useComments', () => ({
  useLikeComment: () => ({ mutate: jest.fn(), isPending: false }),
  useUnlikeComment: () => ({ mutate: jest.fn(), isPending: false }),
  useDeleteComment: () => ({ mutate: jest.fn(), isPending: false }),
}))
jest.mock('@/api/userSafety', () => ({
  __esModule: true,
  reportContent: jest.fn(() => Promise.resolve({ id: 1, status: 'pending' })),
  blockUser: jest.fn(() => Promise.resolve()),
  unblockUser: jest.fn(() => Promise.resolve()),
  fetchReportReasons: jest.fn(() => Promise.resolve([])),
  fetchBlockedUsers: jest.fn(() => Promise.resolve([])),
  isMockReported: jest.fn(() => false),
  isMockBlocked: jest.fn(() => false),
}))

const ME = 7

const comment = (patch: Partial<TravelComment> = {}): TravelComment => ({
  id: 31,
  thread: 1,
  sub_thread: null,
  user: 42,
  text: 'Comment text',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  likes_count: 0,
  user_name: 'Author',
  is_liked: false,
  ...patch,
})

const renderItem = (item: TravelComment) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CommentItem comment={item} />
    </QueryClientProvider>,
  )
}

describe('CommentItem content safety', () => {
  beforeEach(() => {
    ;(useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true, userId: String(ME), isSuperuser: false })
    useAuthStore.setState({ isAuthenticated: true, userId: String(ME) })
    useHiddenContentStore.setState({ byOwner: {} })
  })

  it('shows the 44x44 safety trigger on a foreign comment and no own-actions toggle', () => {
    const { getByTestId, queryByTestId } = renderItem(comment())
    expect(getByTestId('comment-safety-menu')).toBeTruthy()
    expect(queryByTestId('comment-actions-trigger')).toBeNull()
  })

  it('keeps the own edit/delete toggle and no safety trigger on an own comment', () => {
    const { getByTestId, queryByTestId } = renderItem(comment({ user: ME }))
    expect(getByTestId('comment-actions-trigger')).toBeTruthy()
    expect(queryByTestId('comment-safety-menu')).toBeNull()
  })

  it('offers nothing to report on an optimistic comment (temporary positive id, user 0)', () => {
    const { queryByTestId } = renderItem(comment({ id: Date.now(), user: 0 }))
    expect(queryByTestId('comment-safety-menu')).toBeNull()
  })

  it('renders the hidden placeholder instead of a hidden comment', () => {
    useHiddenContentStore.setState({ byOwner: { [String(ME)]: ['travel_comment:31'] } })
    const { getByTestId, queryByText } = renderItem(comment())
    expect(getByTestId('hidden-content')).toBeTruthy()
    expect(queryByText('Comment text')).toBeNull()
  })
})
