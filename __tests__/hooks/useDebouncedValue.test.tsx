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

  // #2184: очищенный поиск применяется сразу, а следующий ввод отсчитывает паузу
  // от него и не воскрешает значение, которое было до сброса.
  it('applies immediate values in the same render and never resurrects the previous one', () => {
    jest.useFakeTimers()
    const isBlank = (value: string) => !value.trim()
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 300, isBlank),
      { initialProps: { value: 'замок' } }
    )

    rerender({ value: '' })
    expect(result.current).toBe('')

    rerender({ value: 'н' })
    expect(result.current).toBe('')
    act(() => {
      jest.advanceTimersByTime(299)
    })
    expect(result.current).toBe('')
    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current).toBe('н')
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

  // #2218 — pending is true in the very render that carries the new value, not
  // one render later: a consumer waiting for «results of the current input»
  // must not see «settled» while the debounced value is still the old one.
  it('reports pending in the same render as the change, and not for a deep-equal copy', () => {
    jest.useFakeTimers()
    const seen: Array<[string, boolean]> = []
    const { rerender } = renderHook(
      ({ value }: { value: { radius: string } }) => {
        const [debounced, pending] = useDebouncedValueWithPending(value, 300)
        seen.push([debounced.radius, pending])
        return pending
      },
      { initialProps: { value: { radius: '60' } } },
    )
    seen.length = 0
    rerender({ value: { radius: '120' } })
    expect(seen[0]).toEqual(['60', true])
    act(() => {
      jest.advanceTimersByTime(300)
    })
    expect(seen.at(-1)).toEqual(['120', false])
    seen.length = 0
    rerender({ value: { radius: '120' } })
    expect(seen.every(([, pending]) => pending === false)).toBe(true)
  })

  it('treats deep-equal objects as equal even with different references', () => {
    expect(deepEqual({ radius: '60', categories: ['lake'] }, { radius: '60', categories: ['lake'] })).toBe(true)
    expect(deepEqual({ radius: '60', categories: ['lake'] }, { radius: '120', categories: ['lake'] })).toBe(false)
  })
})
