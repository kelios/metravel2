/**
 * requestIdleCallback wrapper with setTimeout fallback.
 * Shared across performance-related hooks to avoid duplication.
 * Returns a cancel function so callers can abort the scheduled callback
 * (e.g. on component unmount to prevent state updates after unmount).
 */
export const rIC = (cb: () => void, timeout = 300): (() => void) => {
  const g: any = typeof globalThis !== 'undefined' ? (globalThis as any) : undefined
  if (typeof g?.requestIdleCallback === 'function') {
    const id = g.requestIdleCallback(cb, { timeout })
    return () => {
      if (typeof g?.cancelIdleCallback === 'function') {
        g.cancelIdleCallback(id)
      }
    }
  } else {
    const id = setTimeout(cb, timeout)
    return () => clearTimeout(id)
  }
}
