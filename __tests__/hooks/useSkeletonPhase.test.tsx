import { act, renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { useSkeletonPhase } from '@/hooks/useSkeletonPhase'

describe('useSkeletonPhase (web)', () => {
  const originalOS = Platform.OS
  let originalRaf: typeof globalThis.requestAnimationFrame
  let originalCancelRaf: typeof globalThis.cancelAnimationFrame

  beforeEach(() => {
    Platform.OS = 'web'
    jest.useFakeTimers()
    originalRaf = globalThis.requestAnimationFrame
    originalCancelRaf = globalThis.cancelAnimationFrame
    // Resolve the hide RAF synchronously so phase transitions are observable
    // without scheduling against the fake-timer queue.
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0)
      return 0
    }) as typeof globalThis.requestAnimationFrame
    globalThis.cancelAnimationFrame = (() => {}) as typeof globalThis.cancelAnimationFrame
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
    globalThis.requestAnimationFrame = originalRaf
    globalThis.cancelAnimationFrame = originalCancelRaf
    Platform.OS = originalOS
  })

  it('hides immediately when data and visual are both ready', () => {
    const { result } = renderHook(() =>
      useSkeletonPhase({ isDataReady: true, isVisualReady: true })
    )

    expect(result.current).toBe('hidden')
  })

  it('stays loading when visual-ready never arrives and no fallback is set', () => {
    const { result } = renderHook(() =>
      useSkeletonPhase({ isDataReady: true, isVisualReady: false })
    )

    expect(result.current).toBe('loading')

    act(() => {
      jest.advanceTimersByTime(10_000)
    })

    expect(result.current).toBe('loading')
  })

  it('lifts the overlay on data readiness after the fallback window, without a visual-ready signal', () => {
    const { result } = renderHook(() =>
      useSkeletonPhase({
        isDataReady: true,
        isVisualReady: false,
        visualReadyFallbackMs: 500,
      })
    )

    expect(result.current).toBe('loading')

    act(() => {
      jest.advanceTimersByTime(499)
    })
    expect(result.current).toBe('loading')

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current).toBe('hidden')
  })

  it('does not lift the overlay via fallback while data is not ready', () => {
    const { result } = renderHook(() =>
      useSkeletonPhase({
        isDataReady: false,
        isVisualReady: false,
        visualReadyFallbackMs: 500,
      })
    )

    act(() => {
      jest.advanceTimersByTime(2_000)
    })

    expect(result.current).toBe('loading')
  })

  it('prefers the real visual-ready signal over waiting for the fallback', () => {
    const { result, rerender } = renderHook(
      ({ isVisualReady }) =>
        useSkeletonPhase({
          isDataReady: true,
          isVisualReady,
          visualReadyFallbackMs: 5_000,
        }),
      { initialProps: { isVisualReady: false } }
    )

    expect(result.current).toBe('loading')

    act(() => {
      rerender({ isVisualReady: true })
    })

    expect(result.current).toBe('hidden')
  })
})
