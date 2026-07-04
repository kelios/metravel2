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

    if (typeof window.requestAnimationFrame === 'function') {
      rafOne = window.requestAnimationFrame(() => {
        rafTwo = window.requestAnimationFrame(() => {
          timeoutId = setTimeout(reveal, delayMs)
        })
      })
    } else {
      timeoutId = setTimeout(reveal, delayMs)
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
