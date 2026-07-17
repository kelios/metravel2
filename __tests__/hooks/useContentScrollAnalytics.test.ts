import { act, renderHook } from '@testing-library/react-native'

import { useContentScrollAnalytics } from '@/hooks/useContentScrollAnalytics'
import { queueAnalyticsEvent } from '@/utils/analytics'

jest.mock('@/utils/analytics', () => ({
  queueAnalyticsEvent: jest.fn(),
}))

const scrollEvent = (offsetY: number) => ({
  nativeEvent: {
    contentOffset: { x: 0, y: offsetY },
    contentSize: { width: 390, height: 2000 },
    layoutMeasurement: { width: 390, height: 500 },
  },
})

describe('useContentScrollAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('emits each reached depth once', () => {
    const { result } = renderHook(() => useContentScrollAnalytics({
      source: 'article_detail',
      contentType: 'article',
      contentId: 7,
    }))

    act(() => result.current(scrollEvent(0) as never))
    act(() => result.current(scrollEvent(600) as never))
    act(() => result.current(scrollEvent(1100) as never))
    act(() => result.current(scrollEvent(1100) as never))

    expect(queueAnalyticsEvent).toHaveBeenNthCalledWith(1, 'content_scroll_depth', {
      source: 'article_detail',
      content_type: 'article',
      content_id: '7',
      depth_pct: 25,
    })
    expect(queueAnalyticsEvent).toHaveBeenNthCalledWith(2, 'content_scroll_depth', {
      source: 'article_detail',
      content_type: 'article',
      content_id: '7',
      depth_pct: 50,
    })
    expect(queueAnalyticsEvent).toHaveBeenNthCalledWith(3, 'content_scroll_depth', {
      source: 'article_detail',
      content_type: 'article',
      content_id: '7',
      depth_pct: 75,
    })
    expect(queueAnalyticsEvent).toHaveBeenCalledTimes(3)
  })
})
