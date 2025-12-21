import { act, renderHook } from '@testing-library/react-native'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

describe('useDebouncedValue', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns initial value immediately', () => {
    const { result } = renderHook(
      ({ value, delay }: { value: string; delay: number }) => useDebouncedValue(value, delay),
      { initialProps: { value: 'a', delay: 300 } }
    )

    expect(result.current).toBe('a')
  })

  it('works with different value types', () => {
    const { result } = renderHook(
      ({ value, delay }: { value: { test: string }; delay: number }) => useDebouncedValue(value, delay),
      { initialProps: { value: { test: 'value' }, delay: 300 } }
    )

    expect(result.current).toEqual({ test: 'value' })
  })

  it('debounces updates and skips deep-equal objects', () => {
    jest.useFakeTimers()
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: { term: string }; delay: number }) => useDebouncedValue(value, delay),
      { initialProps: { value: { term: 'moscow' }, delay: 200 } }
    )

    // rerender with deep-equal value should not schedule update
    rerender({ value: { term: 'moscow' }, delay: 200 })
    act(() => {
      jest.advanceTimersByTime(250)
    })
    expect(result.current).toEqual({ term: 'moscow' })

    // change value triggers debounced update after delay
    rerender({ value: { term: 'minsk' }, delay: 200 })
    act(() => {
      jest.advanceTimersByTime(150)
    })
    expect(result.current).toEqual({ term: 'moscow' })
    act(() => {
      jest.advanceTimersByTime(60)
    })
    expect(result.current).toEqual({ term: 'minsk' })
  })
})
