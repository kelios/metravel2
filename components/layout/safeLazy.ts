import React from 'react'

const EmptyFallback = () => null

type SafeLazyOptions = {
  /** Retry the import this many times before falling back (transient Metro async-require rejects). */
  retries?: number
  /** Component rendered if the import keeps failing. Defaults to a no-op (renders nothing). */
  fallback?: React.ComponentType<any>
}

/**
 * React.lazy wrapper hardened against the Metro async-require quirk: `import()` may return a bare
 * thenable without `.catch` for sync-available modules, and may transiently reject during hydration,
 * leaving the lazy section blank. `Promise.resolve` normalizes the thenable; optional `retries`
 * recover from transient rejects; a final `fallback` keeps the tree from throwing.
 */
/**
 * Builds a loader that resolves to the module, retrying transient rejects and finally resolving to a
 * fallback module instead of rejecting — so the consuming `React.lazy`/Suspense never throws.
 * Exported for unit testing the resilience logic without the flaky `React.lazy` + test-renderer path.
 */
export const createResilientLoader = <T extends React.ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
  name?: string,
  options?: SafeLazyOptions
) => {
  const retries = options?.retries ?? 0
  const fallback = (options?.fallback ?? EmptyFallback) as unknown as T

  const attempt = (remaining: number): Promise<{ default: T }> =>
    Promise.resolve(loader()).catch((err) => {
      if (remaining > 0) return attempt(remaining - 1)
      if (__DEV__) console.error(`[safeLazy] Failed to load ${name || 'component'}:`, err)
      return { default: fallback }
    })

  return () => attempt(retries)
}

export const safeLazy = <T extends React.ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
  name?: string,
  options?: SafeLazyOptions
) => React.lazy(createResilientLoader(loader, name, options))

export default safeLazy
