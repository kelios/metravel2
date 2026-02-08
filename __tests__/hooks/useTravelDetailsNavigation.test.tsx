import { act, renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { useTravelDetailsNavigation } from '@/hooks/useTravelDetailsNavigation'

jest.mock('@/hooks/useScrollNavigation', () => ({
  useScrollNavigation: jest.fn(),
}))
jest.mock('@/hooks/useActiveSection', () => ({
  useActiveSection: jest.fn(),
}))

const useScrollNavigation = jest.requireMock('@/hooks/useScrollNavigation')
  .useScrollNavigation as jest.Mock
const useActiveSection = jest.requireMock('@/hooks/useActiveSection')
  .useActiveSection as jest.Mock

describe('useTravelDetailsNavigation', () => {
  const originalOS = Platform.OS
  const originalSelect = Platform.select

  beforeEach(() => {
    Platform.OS = 'web'
    Platform.select = (obj: any) => obj.web ?? obj.default
    jest.useFakeTimers()
  })

  afterEach(() => {
    Platform.OS = originalOS
    Platform.select = originalSelect
    jest.useRealTimers()
  })

  it('scrolls to section after open-section event', () => {
    const scrollTo = jest.fn()
    const scrollRef = {
      current: {
        scrollTo: jest.fn(),
        getScrollableNode: () => ({ getBoundingClientRect: jest.fn() }),
      },
    }

    useScrollNavigation.mockReturnValue({
      anchors: { gallery: { current: null }, map: { current: null } },
      scrollTo,
      scrollRef,
    })

    const setActiveSection = jest.fn()
    useActiveSection.mockReturnValue({
      activeSection: 'gallery',
      setActiveSection,
    })

    const startTransition = (cb: () => void) => cb()

    renderHook(() =>
      useTravelDetailsNavigation({ headerOffset: 72, slug: 'minsk', startTransition })
    )

    act(() => {})

    act(() => {
      window.dispatchEvent(new CustomEvent('open-section', { detail: { key: 'map' } }))
    })

    act(() => {
      jest.advanceTimersByTime(1200)
    })

    expect(scrollTo).toHaveBeenCalledWith('map')
    expect(setActiveSection).toHaveBeenCalledWith('gallery')
  })

  it('applies data-section-key for anchors that mount lazily (regression)', () => {
    const scrollTo = jest.fn()
    const scrollRef = {
      current: {
        scrollTo: jest.fn(),
        getScrollableNode: () => ({ getBoundingClientRect: jest.fn() }),
      },
    }

    const anchors: any = { gallery: { current: null }, map: { current: null } }

    useScrollNavigation.mockReturnValue({
      anchors,
      scrollTo,
      scrollRef,
    })

    const setActiveSection = jest.fn()
    useActiveSection.mockReturnValue({
      activeSection: 'gallery',
      setActiveSection,
    })

    const startTransition = (cb: () => void) => cb()

    renderHook(() => useTravelDetailsNavigation({ headerOffset: 72, slug: 'minsk', startTransition }))

    // Simulate lazy mount: ref.current becomes available after initial effect.
    const el = document.createElement('div')
    anchors.map.current = el

    act(() => {
      jest.advanceTimersByTime(600)
    })

    expect(el.getAttribute('data-section-key')).toBe('map')
  })

  it('uses scrollRef node as scrollRoot when it can scroll by size (regression)', () => {
    const scrollNode: any = {
      scrollHeight: 1000,
      clientHeight: 200,
      getBoundingClientRect: jest.fn(() => ({ top: 0, bottom: 200 } as any)),
    }
    const scrollRef = {
      current: {
        getScrollableNode: () => scrollNode,
        scrollTo: jest.fn(),
      },
    }

    useScrollNavigation.mockReturnValue({
      anchors: { gallery: { current: null } },
      scrollTo: jest.fn(),
      scrollRef,
    })

    const setActiveSection = jest.fn()
    useActiveSection.mockReturnValue({
      activeSection: 'gallery',
      setActiveSection,
    })

    const startTransition = (cb: () => void) => cb()

    const raf = window.requestAnimationFrame
    ;(window as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 0)

    renderHook(() => useTravelDetailsNavigation({ headerOffset: 72, slug: 'minsk', startTransition }))

    act(() => {
      jest.runOnlyPendingTimers()
    })

    const calls = useActiveSection.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    expect(calls[calls.length - 1][2]).toBe(scrollNode)

    ;(window as any).requestAnimationFrame = raf
  })
})
