import { act, renderHook } from '@testing-library/react-native'
import {
  useAnimationFrame,
  useControlledState,
  useDebouncedCallback,
  useDOMElement,
  useEventListener,
  useIdleCallback,
  useIntersectionObserver,
  useInterval,
  useTimeout,
} from '@/hooks/useTravelDetailsUtils'

describe('useTravelDetailsUtils', () => {
  const originalPlatform = require('react-native').Platform.OS
  const originalRequestIdleCallback = (window as any).requestIdleCallback
  const originalCancelIdleCallback = (window as any).cancelIdleCallback
  const originalIntersectionObserver = (global as any).IntersectionObserver

  beforeAll(() => {
    const RN = require('react-native')
    RN.Platform.OS = 'web'
  })

  afterAll(() => {
    const RN = require('react-native')
    RN.Platform.OS = originalPlatform
    ;(window as any).requestIdleCallback = originalRequestIdleCallback
    ;(window as any).cancelIdleCallback = originalCancelIdleCallback
    ;(global as any).IntersectionObserver = originalIntersectionObserver
  })

  it('useTimeout runs once and cleans up', () => {
    jest.useFakeTimers()
    const handler = jest.fn()

    renderHook(() => useTimeout(handler, 100))

    act(() => {
      jest.advanceTimersByTime(100)
    })

    expect(handler).toHaveBeenCalledTimes(1)
    jest.useRealTimers()
  })

  it('useInterval ticks on schedule', () => {
    jest.useFakeTimers()
    const handler = jest.fn()

    renderHook(() => useInterval(handler, 50))

    act(() => {
      jest.advanceTimersByTime(160)
    })

    expect(handler).toHaveBeenCalled()
    jest.useRealTimers()
  })

  it('useDOMElement resolves DOM nodes', () => {
    jest.useFakeTimers()
    const ref = { current: document.createElement('div') }
    const { result } = renderHook(() => useDOMElement(ref))

    act(() => {
      jest.runAllTimers()
    })

    expect(result.current).toBe(ref.current)
    jest.useRealTimers()
  })

  it('useIdleCallback schedules idle work', () => {
    const callback = jest.fn()
    ;(window as any).requestIdleCallback = jest.fn((cb: () => void) => {
      cb()
      return 1
    })
    ;(window as any).cancelIdleCallback = jest.fn()

    renderHook(() => useIdleCallback(callback, { timeout: 10, enabled: true }))

    expect(callback).toHaveBeenCalled()
  })

  it('useIntersectionObserver forwards visibility state', () => {
    const handler = jest.fn()
    const ref = { current: document.createElement('div') }
    const observe = jest.fn()
    let observerCallback: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null

    ;(global as any).IntersectionObserver = jest.fn((cb: any) => {
      observerCallback = cb
      return { observe, disconnect: jest.fn() }
    })

    renderHook(() => useIntersectionObserver(ref, handler))

    act(() => {
      observerCallback?.([{ isIntersecting: true }])
    })

    expect(observe).toHaveBeenCalled()
    expect(handler).toHaveBeenCalledWith(true)
  })

  it('useAnimationFrame drives frame updates', () => {
    const callback = jest.fn()
    let rafCalls = 0
    const rafSpy = jest
      .spyOn(global, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        rafCalls += 1
        if (rafCalls === 1) {
          cb(16)
        }
        return 1
      })
    const cancelSpy = jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {})

    const { unmount } = renderHook(() => useAnimationFrame(callback, true))

    expect(callback).toHaveBeenCalled()
    unmount()
    expect(cancelSpy).toHaveBeenCalled()

    rafSpy.mockRestore()
    cancelSpy.mockRestore()
  })

  it('useEventListener wires DOM events', () => {
    const element = document.createElement('div')
    const handler = jest.fn()

    renderHook(() => useEventListener('click', handler, element))

    act(() => {
      element.dispatchEvent(new Event('click'))
    })

    expect(handler).toHaveBeenCalled()
  })

  it('useControlledState supports controlled and uncontrolled modes', () => {
    const onChange = jest.fn()
    const { result: controlled } = renderHook(() => useControlledState('a', 'b', onChange))

    act(() => {
      controlled.current[1]('c')
    })

    expect(onChange).toHaveBeenCalledWith('c')

    const { result: uncontrolled } = renderHook(() => useControlledState(undefined, 'x'))

    act(() => {
      uncontrolled.current[1]('y')
    })

    expect(uncontrolled.current[0]).toBe('y')
  })

  it('useDebouncedCallback delays execution', () => {
    jest.useFakeTimers()
    const handler = jest.fn()
    const { result } = renderHook(() => useDebouncedCallback(handler, 100))

    act(() => {
      result.current('ping')
      jest.advanceTimersByTime(80)
    })

    expect(handler).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(20)
    })

    expect(handler).toHaveBeenCalledWith('ping')
    jest.useRealTimers()
  })

})
