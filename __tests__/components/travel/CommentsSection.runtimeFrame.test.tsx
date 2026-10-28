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

  it('observes its frame from the first render but reports only real layout', async () => {
    const onRuntimeFrameReady = jest.fn()
    mockUseCommentsData.mockReturnValue({ ...commentsData, isLoading: true })

    const view = await render(
      <CommentsSection
        travelId={42}
        autoload
        lazyLoad
        onRuntimeFrameReady={onRuntimeFrameReady}
      />,
    )

    // react-native-web only observes a node whose layout handler exists at
    // mount, so the skeleton must already carry `onLayout` — it just must not
    // report the skeleton frame upstream.
    const skeleton = screen.getByTestId('comments-skeleton')
    expect(skeleton.props.onLayout).toEqual(expect.any(Function))
    await fireEvent(skeleton, 'layout', {
      nativeEvent: { layout: { height: 226, width: 920, x: 0, y: 0 } },
    })
    expect(onRuntimeFrameReady).not.toHaveBeenCalled()

    mockUseCommentsData.mockReturnValue(commentsData)
    await view.rerender(
      <CommentsSection
        travelId={42}
        autoload
        lazyLoad
        onRuntimeFrameReady={onRuntimeFrameReady}
      />,
    )

    const runtimeNodes = screen.container.queryAll(node => node.props.nativeID === 'comments')
    expect(runtimeNodes).toHaveLength(1)
    const runtime = runtimeNodes[0]
    expect(runtime.props.onLayout).toEqual(expect.any(Function))
    expect(onRuntimeFrameReady).not.toHaveBeenCalled()
    await fireEvent(runtime, 'layout', {
      nativeEvent: { layout: { height: 548, width: 920, x: 0, y: 0 } },
    })
    expect(onRuntimeFrameReady).toHaveBeenCalledTimes(1)
    expect(onRuntimeFrameReady.mock.calls[0][0].nativeEvent.layout.height).toBe(548)
  })
})
