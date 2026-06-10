import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

const isWeb = Platform.OS === 'web'

/** Poll interval: re-check the deployed bundle fingerprint at most this often. */
const POLL_INTERVAL_MS = 15 * 60 * 1000

/**
 * Parses the hash of the main JS bundle out of an HTML document string.
 *
 * Expo web emits the app entry as `/_expo/static/js/web/entry-<hash>.js`. The
 * hash changes on every deploy, so it is a reliable "version" fingerprint that
 * already ships with the build — no extra build artifact / version.json needed.
 */
export function parseEntryBundleHash(html: string): string | null {
  const match = html.match(/\/_expo\/static\/js\/web\/entry-([a-z0-9]+)\.js/i)
  return match ? match[1] : null
}

/**
 * Reads the entry bundle hash from the currently loaded document by inspecting
 * the live `<script src>` tags. This is what the running tab booted with.
 */
function readCurrentEntryHash(): string | null {
  if (typeof document === 'undefined') return null
  const scripts = document.getElementsByTagName('script')
  for (let i = 0; i < scripts.length; i += 1) {
    const src = scripts[i]?.getAttribute('src') ?? ''
    const hash = parseEntryBundleHash(src)
    if (hash) return hash
  }
  return null
}

export interface NewVersionState {
  /** True once a newer deployed bundle hash is detected. */
  available: boolean
  /** Reloads the page to pick up the new bundle. */
  reload: () => void
  /** Hides the prompt until the next time a (different) new version is detected. */
  dismiss: () => void
}

/**
 * Web-only: detects that a new web bundle was deployed while this SPA tab stayed
 * open, so a non-blocking "reload" prompt can be shown. No-op on native.
 *
 * - Starts after mount (never blocks initial load / LCP).
 * - Polls the root HTML (`cache: 'no-store'`) every ~15 min, plus on
 *   focus/visibilitychange (throttled to the poll interval).
 * - Never auto-reloads; reload only happens on explicit user action.
 */
export function useNewVersionAvailable(): NewVersionState {
  const [available, setAvailable] = useState(false)

  const currentHashRef = useRef<string | null>(null)
  const lastCheckedAtRef = useRef(0)
  const dismissedHashRef = useRef<string | null>(null)
  const inFlightRef = useRef(false)

  const checkForUpdate = useCallback(async () => {
    if (!isWeb) return
    if (typeof fetch === 'undefined' || typeof window === 'undefined') return
    if (inFlightRef.current) return
    if (currentHashRef.current == null) return

    const now = Date.now()
    if (now - lastCheckedAtRef.current < POLL_INTERVAL_MS) return
    lastCheckedAtRef.current = now
    inFlightRef.current = true

    try {
      const response = await fetch('/', {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'text/html' },
      })
      if (!response.ok) return
      const html = await response.text()
      const latestHash = parseEntryBundleHash(html)
      if (!latestHash) return
      if (latestHash === currentHashRef.current) return
      if (latestHash === dismissedHashRef.current) return
      setAvailable(true)
    } catch {
      // Network error / offline — silently retry on the next trigger.
    } finally {
      inFlightRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!isWeb) return

    currentHashRef.current = readCurrentEntryHash()
    // If we cannot determine the current hash there is nothing to compare against.
    if (currentHashRef.current == null) return

    let intervalId: ReturnType<typeof setInterval> | null = null

    const startPolling = () => {
      // Seed the throttle so the first poll fires one interval after start,
      // never during the initial load / LCP window.
      lastCheckedAtRef.current = Date.now()
      intervalId = setInterval(() => {
        void checkForUpdate()
      }, POLL_INTERVAL_MS)
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdate()
      }
    }
    const onFocus = () => {
      void checkForUpdate()
    }

    const win = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    let idleId: number | null = null
    let usedIdleCallback = false
    if (typeof win.requestIdleCallback === 'function') {
      usedIdleCallback = true
      idleId = win.requestIdleCallback(startPolling, { timeout: 3000 })
    } else {
      idleId = setTimeout(startPolling, 3000) as unknown as number
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onFocus)

    return () => {
      if (intervalId) clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onFocus)
      if (idleId !== null) {
        if (usedIdleCallback && typeof win.cancelIdleCallback === 'function') {
          try {
            win.cancelIdleCallback(idleId)
          } catch {
            // noop
          }
        } else {
          clearTimeout(idleId)
        }
      }
    }
  }, [checkForUpdate])

  const reload = useCallback(() => {
    if (isWeb && typeof window !== 'undefined') {
      window.location.reload()
    }
  }, [])

  const dismiss = useCallback(() => {
    // Remember the dismissed version so the prompt does not reappear until an
    // even newer bundle is deployed.
    dismissedHashRef.current = currentHashRef.current
    void (async () => {
      try {
        const response = await fetch('/', { cache: 'no-store', credentials: 'same-origin' })
        if (response.ok) {
          const latestHash = parseEntryBundleHash(await response.text())
          if (latestHash) dismissedHashRef.current = latestHash
        }
      } catch {
        // Best effort: fall back to the current hash recorded above.
      }
    })()
    setAvailable(false)
  }, [])

  return { available, reload, dismiss }
}
