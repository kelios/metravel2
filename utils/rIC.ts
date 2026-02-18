/**
 * requestIdleCallback wrapper with setTimeout fallback.
 * Shared across performance-related hooks to avoid duplication.
 * Returns a cancel function so callers can abort the scheduled callback
 * (e.g. on component unmount to prevent state updates after unmount).
 */
export const rIC = (cb: () => void, timeout = 300): (() => void) => {
  const g: any = typeof globalThis !== 'undefined' ? (globalThis as any) : undefined

  let didRun = false
  const runOnce = () => {
    if (didRun) return
    didRun = true
    cb()
  }

  if (typeof g?.requestIdleCallback === 'function') {
    const idleId = g.requestIdleCallback(runOnce, { timeout })
    // Some browsers/environments can delay rIC indefinitely under load.
    // Ensure the callback runs no later than shortly after `timeout`.
    const timerId = setTimeout(runOnce, timeout + 50)
    return () => {
      didRun = true
      clearTimeout(timerId)
      if (typeof g?.cancelIdleCallback === 'function') {
        g.cancelIdleCallback(idleId)
      }
    }
  }

  const timerId = setTimeout(runOnce, timeout)
  return () => {
    didRun = true
    clearTimeout(timerId)
  }
}
