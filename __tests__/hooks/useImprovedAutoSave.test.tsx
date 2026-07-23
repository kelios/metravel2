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

  it('keeps changes local while offline and saves them after reconnect', async () => {
    jest.useFakeTimers()
    const onSave = jest.fn(async (data: { value: string }) => data)

    const { result, rerender } = renderHook(
      ({ data, isOnline }) =>
        useImprovedAutoSave(data, { value: 'initial' }, {
          debounce: 50,
          onSave,
          isOnline,
        }),
      { initialProps: { data: { value: 'initial' }, isOnline: false } },
    )

    rerender({ data: { value: 'offline edit' }, isOnline: false })
    await act(async () => {
      jest.advanceTimersByTime(60)
      await Promise.resolve()
    })

    expect(onSave).not.toHaveBeenCalled()
    expect(result.current.isOnline).toBe(false)
    expect(result.current.hasUnsavedChanges).toBe(true)

    rerender({ data: { value: 'offline edit' }, isOnline: true })
    await act(async () => {
      jest.advanceTimersByTime(60)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ value: 'offline edit' }, expect.any(Object))
    expect(result.current.isOnline).toBe(true)
  })

  it('does not retry an expired-session response', async () => {
    jest.useFakeTimers()
    const authError = Object.assign(new Error('Unauthorized'), { status: 401 })
    const onSave = jest.fn(async () => {
      throw authError
    })
    const onError = jest.fn()

    const { result, rerender } = renderHook(
      ({ data }) =>
        useImprovedAutoSave(data, { value: 'initial' }, {
          debounce: 20,
          retryDelay: 10,
          onSave,
          onError,
          isOnline: true,
        }),
      { initialProps: { data: { value: 'initial' } } },
    )

    rerender({ data: { value: 'needs auth' } })
    await act(async () => {
      jest.advanceTimersByTime(200)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(authError)
    expect(result.current.status).toBe('error')
    expect((result.current.error as Error & { status?: number }).status).toBe(401)

    rerender({ data: { value: 'another local edit' } })
    await act(async () => {
      jest.advanceTimersByTime(200)
      await Promise.resolve()
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('error')
    expect((result.current.error as Error & { status?: number }).status).toBe(401)
  })
})
