import { act, renderHook } from '@testing-library/react-native'

import { useTravelDetailsScrollState } from '@/hooks/useTravelDetailsScrollState'

let scrollHandler: ((value: number) => void) | null = null

jest.mock('@/hooks/useTravelDetailsUtils', () => {
  const actual = jest.requireActual('@/hooks/useTravelDetailsUtils')
  return {
    ...actual,
    useScrollListener: jest.fn((_scrollY: any, handler: (value: number) => void) => {
      scrollHandler = handler
    }),
  }
})

describe('useTravelDetailsScrollState', () => {
  beforeEach(() => {
    scrollHandler = null
  })

  it('tracks content and viewport measurements', () => {
    const { result } = renderHook(() =>
      useTravelDetailsScrollState({ isMobile: true })
    )

    act(() => {
      result.current.handleContentSizeChange(0, 1200)
    })
    act(() => {
      result.current.handleLayout({ nativeEvent: { layout: { height: 640 } } })
    })

    expect(result.current.contentHeight).toBe(1200)
    expect(result.current.viewportHeight).toBe(640)
  })

  it('toggles mobile section tabs based on scroll position', () => {
    const { result, rerender } = renderHook(
      ({ isMobile }) => useTravelDetailsScrollState({ isMobile }),
      { initialProps: { isMobile: true } }
    )

    act(() => {
      result.current.setHeroBlockHeight(200)
    })

    act(() => {
      scrollHandler?.(250)
    })
    expect(result.current.showMobileSectionTabs).toBe(true)

    act(() => {
      scrollHandler?.(0)
    })
    expect(result.current.showMobileSectionTabs).toBe(false)

    rerender({ isMobile: false })
    expect(result.current.showMobileSectionTabs).toBe(false)
  })
})
