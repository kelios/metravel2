/**
 * @jest-environment jsdom
 */
/**
 * Регрессия: гейт гидратации не должен зависеть ТОЛЬКО от requestAnimationFrame —
 * rAF приостановлен в фоновой/неактивной вкладке, из-за чего гейтованные экраны
 * (/map и др.) застревали на пустом hydration-fallback (нет карты, нет точек) при
 * загрузке страницы без фокуса. setTimeout обязан открыть гейт и без единого rAF.
 */
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }))

import { act, renderHook } from '@testing-library/react'

import { useWebHydrationGate } from '@/hooks/useWebHydrationGate'

describe('useWebHydrationGate', () => {
  const originalRaf = global.requestAnimationFrame
  const originalCancelRaf = global.cancelAnimationFrame

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    global.requestAnimationFrame = originalRaf
    global.cancelAnimationFrame = originalCancelRaf
  })

  it('opens even when requestAnimationFrame never fires (background/hidden tab)', () => {
    // Фоновая вкладка: rAF зарегистрирован, но колбэк НИКОГДА не вызывается.
    const rafCallbacks: FrameRequestCallback[] = []
    const raf = jest.fn((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    }) as unknown as typeof requestAnimationFrame
    global.requestAnimationFrame = raf
    window.requestAnimationFrame = raf
    global.cancelAnimationFrame = jest.fn() as unknown as typeof cancelAnimationFrame
    window.cancelAnimationFrame = global.cancelAnimationFrame

    const { result } = renderHook(() => useWebHydrationGate(120))

    act(() => {
      jest.advanceTimersByTime(120)
    })

    // Гейт открылся, хотя ни один rAF-колбэк не был выполнен — значит триггером
    // выступил гарантированный setTimeout, а не приостановленный в фоне rAF.
    expect(result.current).toBe(true)
  })

  it('opens via the rAF fast path when frames run', () => {
    global.requestAnimationFrame = jest.fn((cb: FrameRequestCallback) => {
      cb(0)
      return 1
    }) as unknown as typeof requestAnimationFrame
    global.cancelAnimationFrame = jest.fn() as unknown as typeof cancelAnimationFrame

    const { result } = renderHook(() => useWebHydrationGate(120))

    act(() => {
      jest.advanceTimersByTime(0)
    })

    expect(result.current).toBe(true)
  })
})
