/**
 * requestIdleCallback wrapper with setTimeout fallback.
 * Shared across performance-related hooks to avoid duplication.
 */
export const rIC = (cb: () => void, timeout = 300): void => {
  if (typeof (window as any)?.requestIdleCallback === 'function') {
    ;(window as any).requestIdleCallback(cb, { timeout })
  } else {
    setTimeout(cb, timeout)
  }
}
