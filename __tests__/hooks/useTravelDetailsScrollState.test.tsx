import { act, renderHook } from '@testing-library/react-native'

import { useTravelDetailsScrollState } from '@/hooks/useTravelDetailsScrollState'

describe('useTravelDetailsScrollState', () => {
  it('tracks content and viewport measurements', () => {
    const { result } = renderHook(() => useTravelDetailsScrollState())

    act(() => {
      result.current.handleContentSizeChange(0, 1200)
    })
    act(() => {
      result.current.handleLayout({ nativeEvent: { layout: { height: 640 } } })
    })

    expect(result.current.contentHeight).toBe(1200)
    expect(result.current.viewportHeight).toBe(640)
  })
})
