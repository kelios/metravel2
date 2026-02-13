/**
 * @jest-environment node
 */

import { rIC } from '@/utils/rIC'

describe('rIC (node env)', () => {
  const removeWindowGlobal = () => {
    const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window')
    const originalWindow = (globalThis as any).window
    const deleted = delete (globalThis as any).window
    return { hadWindow, originalWindow, deleted }
  }

  const restoreWindowGlobal = (state: { hadWindow: boolean; originalWindow: any }) => {
    if (state.hadWindow) {
      ;(globalThis as any).window = state.originalWindow
      return
    }
    delete (globalThis as any).window
  }

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('falls back to setTimeout when requestIdleCallback is unavailable', () => {
    const windowState = removeWindowGlobal()
    let called = false
    try {
      expect(windowState.deleted).toBe(true)
      // If the global `window` binding is truly absent, accessing it must throw.
      expect(() => (window as any)).toThrow(ReferenceError)

      const cancel = rIC(() => {
        called = true
      }, 10)

      expect(typeof cancel).toBe('function')

      jest.advanceTimersByTime(9)
      expect(called).toBe(false)

      jest.advanceTimersByTime(1)
      expect(called).toBe(true)
    } finally {
      restoreWindowGlobal(windowState)
    }
  })

  it('cancel prevents the fallback callback from firing', () => {
    const windowState = removeWindowGlobal()
    let called = false
    try {
      expect(windowState.deleted).toBe(true)
      expect(() => (window as any)).toThrow(ReferenceError)

      const cancel = rIC(() => {
        called = true
      }, 10)

      cancel()
      jest.advanceTimersByTime(20)
      expect(called).toBe(false)
    } finally {
      restoreWindowGlobal(windowState)
    }
  })
})
