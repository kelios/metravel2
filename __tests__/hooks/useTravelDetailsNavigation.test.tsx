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
})
