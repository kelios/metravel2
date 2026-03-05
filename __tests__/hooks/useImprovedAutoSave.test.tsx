import { act, renderHook } from '@testing-library/react-native'

import { useImprovedAutoSave } from '@/hooks/useImprovedAutoSave'

describe('useImprovedAutoSave', () => {
  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  it('does not switch to error state for an aborted save', async () => {
    jest.useFakeTimers()

    const onSave = jest.fn(async () => {
      throw new Error('Request aborted')
    })
    const onError = jest.fn()

    const { result, rerender } = renderHook(
      ({ data }) =>
        useImprovedAutoSave(data, { value: 'initial' }, {
          debounce: 50,
          onSave,
          onError,
        }),
      {
        initialProps: { data: { value: 'initial' } },
      }
    )

    rerender({ data: { value: 'updated' } })

    await act(async () => {
      jest.advanceTimersByTime(60)
      await Promise.resolve()
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeNull()
  })
})
