import { fireEvent, render, screen } from '@testing-library/react-native'

import { CommentsSection } from '@/components/travel/CommentsSection'

const mockUseCommentsData = jest.fn()

jest.mock('@/hooks/useCommentsData', () => ({
  useCommentsData: (...args: unknown[]) => mockUseCommentsData(...args),
}))

const commentsData = {
  isAuthenticated: false,
  comments: [],
  topLevel: [],
  replies: {},
  getParentChain: jest.fn(() => []),
  expandedThreads: new Set<number>(),
  replyTo: null,
  editComment: null,
  isLoading: false,
  isRefreshing: false,
  isSubmitting: false,
  hasError: false,
  threadError: null,
  commentsError: null,
  mainThread: null,
  handleRefresh: jest.fn(),
  handleSubmitComment: jest.fn(),
  handleReply: jest.fn(),
  handleEdit: jest.fn(),
  handleCancelReply: jest.fn(),
  handleCancelEdit: jest.fn(),
  toggleThread: jest.fn(),
  expandAllThreads: jest.fn(),
  collapseAllThreads: jest.fn(),
  handleLoginPress: jest.fn(),
}

describe('CommentsSection deferred runtime frame', () => {
  beforeEach(() => {
    mockUseCommentsData.mockReset()
  })

  it('reports layout only after the comments query leaves its loading skeleton', () => {
    const onRuntimeFrameReady = jest.fn()
    mockUseCommentsData.mockReturnValue({ ...commentsData, isLoading: true })

    const view = render(
      <CommentsSection
        travelId={42}
        autoload
        lazyLoad
        onRuntimeFrameReady={onRuntimeFrameReady}
      />,
    )

    expect(screen.getByTestId('comments-skeleton').props.onLayout).toBeUndefined()

    mockUseCommentsData.mockReturnValue(commentsData)
    view.rerender(
      <CommentsSection
        travelId={42}
        autoload
        lazyLoad
        onRuntimeFrameReady={onRuntimeFrameReady}
      />,
    )

    const runtime = screen.UNSAFE_getByProps({ nativeID: 'comments' })
    expect(runtime.props.onLayout).toBe(onRuntimeFrameReady)
    expect(onRuntimeFrameReady).not.toHaveBeenCalled()
    fireEvent(runtime, 'layout', {
      nativeEvent: { layout: { height: 548, width: 920, x: 0, y: 0 } },
    })
    expect(onRuntimeFrameReady).toHaveBeenCalledTimes(1)
  })
})
