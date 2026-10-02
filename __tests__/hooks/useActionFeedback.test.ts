import { AccessibilityInfo, Platform } from 'react-native'
import { act, renderHook } from '@testing-library/react-native'

import { useActionFeedback } from '@/hooks/useActionFeedback'
import { hapticImpact, hapticNotification } from '@/utils/haptics'
import { showToast } from '@/utils/toast'

jest.mock('@/utils/toast', () => ({ showToast: jest.fn() }))
jest.mock('@/utils/haptics', () => ({
  hapticImpact: jest.fn(),
  hapticNotification: jest.fn(),
}))

const toast = showToast as jest.Mock

describe('useActionFeedback', () => {
  const originalOS = Platform.OS
  let announce: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    ;(Platform as any).OS = 'ios'
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined)
  })
  afterEach(() => {
    ;(Platform as any).OS = originalOS
    announce.mockRestore()
  })

  it('applies optimistic state and haptic before commit, then toasts success with undo and announces', async () => {
    const order: string[] = []
    const { result } = renderHook(() => useActionFeedback())
    const undoCommit = jest.fn().mockResolvedValue(undefined)

    let outcome: any
    await act(async () => {
      outcome = await result.current.run({
        haptic: 'medium',
        optimistic: () => order.push('optimistic'),
        commit: async () => {
          order.push('commit')
          return 42
        },
        success: { message: 'Добавлено в избранное', undo: { commit: undoCommit } },
      })
    })

    expect(order).toEqual(['optimistic', 'commit'])
    expect(hapticImpact).toHaveBeenCalledWith('medium')
    expect(outcome).toEqual({ status: 'success', value: 42 })
    const payload = toast.mock.calls[0][0]
    expect(payload).toMatchObject({ type: 'success', text1: 'Добавлено в избранное', position: 'bottom' })
    expect(payload.action.label).toBe('Отменить')
    expect(announce).toHaveBeenCalledWith('Добавлено в избранное')

    await act(async () => {
      payload.action.onPress()
    })
    expect(undoCommit).toHaveBeenCalledTimes(1)
  })

  it('does not toast an undo action when no undo is passed', async () => {
    const { result } = renderHook(() => useActionFeedback())
    await act(async () => {
      await result.current.run({ commit: async () => 1, success: { message: 'Готово' } })
    })
    expect(toast.mock.calls[0][0].action).toBeUndefined()
  })

  it('rolls back, shows error toast and error haptic when commit fails', async () => {
    const rollback = jest.fn()
    const { result } = renderHook(() => useActionFeedback())
    let outcome: any
    await act(async () => {
      outcome = await result.current.run({
        optimistic: jest.fn(),
        rollback,
        commit: async () => {
          throw new Error('offline')
        },
        success: { message: 'ok' },
        error: { message: 'Не удалось обновить избранное' },
      })
    })
    expect(outcome.status).toBe('error')
    expect(rollback).toHaveBeenCalledTimes(1)
    expect(hapticNotification).toHaveBeenCalledWith('error')
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast.mock.calls[0][0]).toMatchObject({ type: 'error', text1: 'Не удалось обновить избранное' })
  })

  it('ignores a second tap with the same key while commit is pending', async () => {
    const { result } = renderHook(() => useActionFeedback())
    let release!: () => void
    const commit = jest.fn(() => new Promise<void>((resolve) => { release = resolve }))

    let first!: Promise<any>
    let second: any
    await act(async () => {
      first = result.current.run({ key: 'a', commit })
      second = await result.current.run({ key: 'a', commit })
    })
    expect(second).toEqual({ status: 'busy' })
    expect(commit).toHaveBeenCalledTimes(1)
    await act(async () => {
      release()
      await first
    })
    // другой ключ не блокируется
    await act(async () => {
      await result.current.run({ key: 'b', commit: async () => undefined })
    })
  })

  it('failed undo rolls back and reports an error', async () => {
    const undoRollback = jest.fn()
    const { result } = renderHook(() => useActionFeedback())
    await act(async () => {
      await result.current.run({
        commit: async () => undefined,
        success: {
          message: 'ok',
          undo: { commit: async () => { throw new Error('x') }, rollback: undoRollback },
        },
        error: { message: 'Ошибка' },
      })
    })
    await act(async () => {
      toast.mock.calls[0][0].action.onPress()
    })
    expect(undoRollback).toHaveBeenCalled()
    expect(toast.mock.calls[1][0]).toMatchObject({ type: 'error', text1: 'Ошибка' })
  })

  it('does not announce on web (toast role=status speaks)', async () => {
    ;(Platform as any).OS = 'web'
    const { result } = renderHook(() => useActionFeedback())
    await act(async () => {
      await result.current.run({ commit: async () => undefined, success: { message: 'ok' } })
    })
    expect(announce).not.toHaveBeenCalled()
  })
})
