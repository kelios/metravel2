import { runAfterInteractions } from '@/utils/runAfterInteractions'

type IdleGlobal = {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

describe('runAfterInteractions (InteractionManager replacement, #2727)', () => {
  const idleGlobal = globalThis as unknown as IdleGlobal
  const original = { request: idleGlobal.requestIdleCallback, cancel: idleGlobal.cancelIdleCallback }

  afterEach(() => {
    idleGlobal.requestIdleCallback = original.request
    idleGlobal.cancelIdleCallback = original.cancel
    jest.useRealTimers()
  })

  it('defers the task to an idle callback bounded by the timeout and runs it once', () => {
    let idle: (() => void) | undefined
    idleGlobal.requestIdleCallback = jest.fn((callback, _options) => {
      idle = callback
      return 7
    })
    idleGlobal.cancelIdleCallback = jest.fn()
    const task = jest.fn()

    runAfterInteractions(task, 250)

    expect(idleGlobal.requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 250 })
    expect(task).not.toHaveBeenCalled()
    idle?.()
    idle?.()
    expect(task).toHaveBeenCalledTimes(1)
  })

  it('cancels a pending idle task', () => {
    let idle: (() => void) | undefined
    idleGlobal.requestIdleCallback = jest.fn((callback) => {
      idle = callback
      return 7
    })
    idleGlobal.cancelIdleCallback = jest.fn()
    const task = jest.fn()

    runAfterInteractions(task).cancel()
    idle?.()

    expect(idleGlobal.cancelIdleCallback).toHaveBeenCalledWith(7)
    expect(task).not.toHaveBeenCalled()
  })

  it('falls back to a macrotask without requestIdleCallback and honours cancel', () => {
    jest.useFakeTimers()
    idleGlobal.requestIdleCallback = undefined
    const task = jest.fn()
    const cancelled = jest.fn()

    runAfterInteractions(task)
    runAfterInteractions(cancelled).cancel()
    expect(task).not.toHaveBeenCalled()
    jest.runAllTimers()

    expect(task).toHaveBeenCalledTimes(1)
    expect(cancelled).not.toHaveBeenCalled()
  })
})
