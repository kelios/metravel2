import { act, renderHook } from '@testing-library/react'
import { Platform } from 'react-native'

import { useLocalCalendarDate } from '@/hooks/useLocalCalendarDate'

/**
 * #3467: хук питает контекст темы над всеми Suspense-границами. Новый объект
 * Date при монтировании в тот же день менял контекст во время гидратации, и
 * React догидратировал всю страницу синхронно (в том числе внутри первого тапа).
 */
describe('useLocalCalendarDate', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('keeps the initial Date instance after mount on the same calendar day', () => {
    jest.setSystemTime(new Date(2026, 10, 21, 10, 0, 0))
    const { result, unmount } = renderHook(() => useLocalCalendarDate())
    const initial = result.current

    // Эффект монтирования уже отработал: часы ушли вперёд, но день тот же.
    jest.setSystemTime(new Date(2026, 10, 21, 18, 30, 0))
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })

    expect(result.current).toBe(initial)
    unmount()
  })

  it('publishes a new Date when the calendar day changes', () => {
    jest.setSystemTime(new Date(2026, 10, 21, 23, 59, 59))
    const { result, unmount } = renderHook(() => useLocalCalendarDate())
    const initial = result.current

    act(() => {
      jest.advanceTimersByTime(1000)
    })

    expect(result.current).not.toBe(initial)
    expect(result.current.getDate()).toBe(22)
    unmount()
  })
})
