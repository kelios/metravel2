import React from 'react'
import { renderHook, act } from '@testing-library/react-native'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

jest.useFakeTimers()

describe('useDebouncedValue', () => {
  it('returns initial value immediately and updates after delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 'a', delay: 300 } }
    )

    expect(result.current).toBe('a')

    rerender({ value: 'b', delay: 300 })

    // До истечения таймера значение не должно измениться
    expect(result.current).toBe('a')

    act(() => {
      jest.advanceTimersByTime(299)
    })
    expect(result.current).toBe('a')

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current).toBe('b')
  })

  it('uses deep equality to avoid unnecessary updates for equal objects', () => {
    const initial = { q: 'test', filters: [1, 2, { a: 3 }] }

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: initial, delay: 300 } }
    )

    expect(result.current).toBe(initial)

    const sameShape = { q: 'test', filters: [1, 2, { a: 3 }] }

    rerender({ value: sameShape, delay: 300 })

    // deepEqual должен вернуть true и debounce не должен запускаться
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    // Значение не должно быть обновлено на новый объект-ссылку
    expect(result.current).toBe(initial)
  })
})
