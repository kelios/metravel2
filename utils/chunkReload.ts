// Stale-deploy recovery for code-split chunks.
//
// app.json enables expo-router `asyncRoutes.web`, so every web route — and every
// React.lazy() — is a separate hashed chunk loaded via dynamic import(). After a
// new deploy the hashes change: a client still running the old index.html asks
// for a chunk filename that no longer exists, the import() rejects with a
// ChunkLoadError, the route component never resolves and the page goes blank.
//
// There is no per-import hook for expo-router's internal route chunks, so we
// recover globally: detect a chunk-load failure (unhandledrejection from the
// import(), or a failed <script> load event) and do a single, guarded full
// reload to pull the fresh index + chunk map. The sessionStorage guard makes the
// reload one-shot so a genuinely-missing chunk can never loop.

import React from 'react'
import { Platform } from 'react-native'

const RELOAD_GUARD_KEY = 'mt:chunk-reload-ts'
const RELOAD_WINDOW_MS = 30_000

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false
  const name = (error as { name?: unknown })?.name
  if (name === 'ChunkLoadError') return true
  const message = error instanceof Error ? error.message : String(error)
  if (!message) return false
  return (
    /Loading chunk\s+[^\s]+\s+failed/i.test(message) ||
    /Loading CSS chunk/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /ChunkLoadError/i.test(message)
  )
}

function reloadOnceForStaleChunk(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false
  try {
    const now = Date.now()
    const raw = window.sessionStorage?.getItem(RELOAD_GUARD_KEY)
    const last = raw ? Number(raw) : 0
    if (Number.isFinite(last) && last > 0 && now - last < RELOAD_WINDOW_MS) {
      // Already reloaded recently and the chunk is still missing — don't loop.
      return false
    }
    window.sessionStorage?.setItem(RELOAD_GUARD_KEY, String(now))
  } catch {
    // sessionStorage unavailable (private mode / blocked): fall through and
    // reload anyway. Without the guard we accept at most a rare double reload.
  }
  try {
    window.location.reload()
  } catch {
    return false
  }
  return true
}

let handlerInstalled = false

/**
 * Install once, early on web. Listens for chunk-load failures from dynamic
 * imports (expo-router route chunks + our React.lazy chunks) and recovers with a
 * single guarded reload. No-op on native and after the first install.
 */
export function installChunkErrorReloadHandler(): void {
  if (handlerInstalled) return
  if (Platform.OS !== 'web' || typeof window === 'undefined') return
  handlerInstalled = true

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    if (isChunkLoadError(event?.reason)) {
      reloadOnceForStaleChunk()
    }
  })

  window.addEventListener(
    'error',
    (event: ErrorEvent) => {
      // Failed <script>/<link> resource loads surface as error events on the
      // element with no message; the import() rejection above is the primary
      // signal, this catches the eager <script> case.
      const target = event?.target as { tagName?: string; src?: string } | null
      const tag = target?.tagName
      if ((tag === 'SCRIPT' || tag === 'LINK') && typeof target?.src === 'string' && /\.(js|css)(\?|$)/i.test(target.src)) {
        // Only react to our own chunk URLs (same origin) to avoid reloading on
        // unrelated third-party script errors.
        try {
          const url = new URL(target.src, window.location.href)
          if (url.origin === window.location.origin) {
            reloadOnceForStaleChunk()
          }
        } catch {
          /* ignore malformed URLs */
        }
        return
      }
      if (isChunkLoadError(event?.error)) {
        reloadOnceForStaleChunk()
      }
    },
    true, // capture: resource error events don't bubble
  )
}

export interface LazyRetryOptions {
  retries?: number
  retryDelayMs?: number
  name?: string
}

/**
 * Resolve a dynamic import with a couple of retries (handles a transient blip),
 * then a one-time reload if the failure looks like a stale-deploy chunk miss.
 */
export function importWithRetry<T>(
  factory: () => Promise<T>,
  options: LazyRetryOptions = {},
): Promise<T> {
  const { retries = 2, retryDelayMs = 350, name } = options

  const attempt = (remaining: number): Promise<T> =>
    // Metro async-require may return a bare thenable (no .catch) for sync-available modules
    Promise.resolve(factory()).catch((error: unknown) => {
      const chunkError = isChunkLoadError(error)
      if (remaining > 0) {
        return new Promise<T>((resolve) => {
          setTimeout(() => resolve(attempt(remaining - 1)), retryDelayMs)
        })
      }
      if (chunkError && reloadOnceForStaleChunk()) {
        // Reload is navigating away; never resolve so React doesn't flash an
        // error boundary in the frame before the page unloads.
        return new Promise<T>(() => {})
      }
      if (__DEV__ && name) {
        console.error(`[importWithRetry] Failed to load ${name}:`, error)
      }
      throw error
    })

  return attempt(retries)
}

/**
 * Drop-in for React.lazy with stale-deploy chunk recovery.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  options: LazyRetryOptions = {},
): React.LazyExoticComponent<T> {
  return React.lazy(() => importWithRetry(factory, options))
}
