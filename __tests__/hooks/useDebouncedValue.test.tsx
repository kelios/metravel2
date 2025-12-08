import React from 'react'
import { renderHook } from '@testing-library/react-native'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

describe('useDebouncedValue', () => {
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
})
