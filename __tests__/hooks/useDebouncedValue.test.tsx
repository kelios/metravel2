import { act, renderHook } from '@testing-library/react-native'
import { deepEqual, useDebouncedValue, useDebouncedValueWithPending } from '@/hooks/useDebouncedValue'

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

  it('does not cancel a pending debounced update on a deep-equal rerender', () => {
    jest.useFakeTimers()
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: { term: string }; delay: number }) => useDebouncedValue(value, delay),
      { initialProps: { value: { term: 'moscow' }, delay: 200 } }
    )

    rerender({ value: { term: 'minsk' }, delay: 200 })
    rerender({ value: { term: 'minsk' }, delay: 200 })

    act(() => {
      jest.advanceTimersByTime(210)
    })

    expect(result.current).toEqual({ term: 'minsk' })
  })

  it('clears pending after a deep-equal rerender during debounce', () => {
    jest.useFakeTimers()
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: { latitude: number; longitude: number }; delay: number }) =>
        useDebouncedValueWithPending(value, delay),
      { initialProps: { value: { latitude: 53.9006, longitude: 27.559 }, delay: 200 } }
    )

    rerender({ value: { latitude: 50.0614, longitude: 19.9366 }, delay: 200 })
    expect(result.current[1]).toBe(true)

    rerender({ value: { latitude: 50.0614, longitude: 19.9366 }, delay: 200 })

    act(() => {
      jest.advanceTimersByTime(210)
    })

    expect(result.current[0]).toEqual({ latitude: 50.0614, longitude: 19.9366 })
    expect(result.current[1]).toBe(false)
  })

  it('treats deep-equal objects as equal even with different references', () => {
    expect(deepEqual({ radius: '60', categories: ['lake'] }, { radius: '60', categories: ['lake'] })).toBe(true)
    expect(deepEqual({ radius: '60', categories: ['lake'] }, { radius: '120', categories: ['lake'] })).toBe(false)
  })
})
