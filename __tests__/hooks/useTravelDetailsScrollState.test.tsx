import { act, renderHook } from '@testing-library/react-native'

import { useTravelDetailsScrollState } from '@/hooks/useTravelDetailsScrollState'

describe('useTravelDetailsScrollState', () => {
  it('tracks content and viewport measurements', async () => {
    const { result } = await renderHook(() => useTravelDetailsScrollState())

    await act(() => {
      result.current.handleContentSizeChange(0, 1200)
    })
    await act(() => {
      result.current.handleLayout({ nativeEvent: { layout: { height: 640 } } })
    })

    expect(result.current.contentHeight).toBe(1200)
    expect(result.current.viewportHeight).toBe(640)
  })
})
