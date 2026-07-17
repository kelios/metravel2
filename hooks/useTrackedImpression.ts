import { useCallback, useEffect, useRef } from 'react'
import { Platform } from 'react-native'

type TrackedImpression = {
  ref: (node: unknown) => void
  onLayout: () => void
}

/**
 * Fires an analytics impression once when at least half of a web element is visible.
 * Native analytics is currently disabled, so onLayout is only a parity-safe fallback.
 */
export function useTrackedImpression(
  impressionKey: string,
  onImpression: () => void,
): TrackedImpression {
  const firedRef = useRef(false)
  const disconnectRef = useRef<(() => void) | undefined>(undefined)
  const callbackRef = useRef(onImpression)
  callbackRef.current = onImpression

  useEffect(() => {
    firedRef.current = false
    disconnectRef.current?.()
    disconnectRef.current = undefined
  }, [impressionKey])

  const fireOnce = useCallback(() => {
    if (firedRef.current) return
    firedRef.current = true
    callbackRef.current()
  }, [])

  const setRef = useCallback((node: unknown) => {
    disconnectRef.current?.()
    disconnectRef.current = undefined

    if (Platform.OS !== 'web' || !node || firedRef.current) return
    if (typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) {
          fireOnce()
          observer.disconnect()
        }
      },
      { threshold: 0.5 },
    )

    observer.observe(node as Element)
    disconnectRef.current = () => observer.disconnect()
  }, [fireOnce])

  const onLayout = useCallback(() => {
    if (Platform.OS !== 'web') fireOnce()
  }, [fireOnce])

  useEffect(() => () => disconnectRef.current?.(), [])

  return { ref: setRef, onLayout }
}
