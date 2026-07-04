import { startTransition, useEffect, useState } from 'react'
import { Platform } from 'react-native'

const canUseDOM = () =>
  typeof window !== 'undefined' &&
  typeof document !== 'undefined' &&
  typeof document.createElement === 'function'

export function useWebHydrationGate(delayMs = 120): boolean {
  const [ready, setReady] = useState(() => {
    if (!canUseDOM()) return false
    return Platform.OS !== 'web'
  })

  useEffect(() => {
    if (Platform.OS !== 'web' || !canUseDOM()) {
      setReady(true)
      return undefined
    }

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let rafOne: number | null = null
    let rafTwo: number | null = null

    const reveal = () => {
      if (cancelled) return
      startTransition(() => setReady(true))
    }

    // Guaranteed reveal: setTimeout keeps firing in background/hidden tabs
    // (throttled, but it runs), whereas requestAnimationFrame is PAUSED while the
    // tab isn't visible. Relying on rAF alone left gated screens (e.g. /map) stuck
    // on their empty hydration fallback — no map, no markers — whenever the page
    // hydrated while unfocused. The timeout is the load-bearing trigger.
    timeoutId = setTimeout(reveal, delayMs)

    // Fast path: when the tab is visible, reveal on the next frame(s) for a smoother
    // paint. reveal() is idempotent, so racing it with the timeout above is safe —
    // rAF is only an optimization here, never the sole trigger.
    if (typeof window.requestAnimationFrame === 'function') {
      rafOne = window.requestAnimationFrame(() => {
        rafTwo = window.requestAnimationFrame(reveal)
      })
    }

    return () => {
      cancelled = true
      if (rafOne !== null) window.cancelAnimationFrame(rafOne)
      if (rafTwo !== null) window.cancelAnimationFrame(rafTwo)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [delayMs])

  return ready
}
