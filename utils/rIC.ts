/**
 * requestIdleCallback wrapper with setTimeout fallback.
 * Shared across performance-related hooks to avoid duplication.
 * Returns a cancel function so callers can abort the scheduled callback
 * (e.g. on component unmount to prevent state updates after unmount).
 */
export const rIC = (cb: () => void, timeout = 300): (() => void) => {
  if (typeof (window as any)?.requestIdleCallback === 'function') {
    const id = (window as any).requestIdleCallback(cb, { timeout })
    return () => {
      if (typeof (window as any)?.cancelIdleCallback === 'function') {
        ;(window as any).cancelIdleCallback(id)
      }
    }
  } else {
    const id = setTimeout(cb, timeout)
    return () => clearTimeout(id)
  }
}
