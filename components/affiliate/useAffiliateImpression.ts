import { useCallback, useEffect, useRef } from 'react'
import { Platform } from 'react-native'

/**
 * FE-3: fire an impression callback once when the affiliate block first scrolls
 * into view (≥50% visible). Web-only; on native or without IntersectionObserver
 * support it stays inert. Returns a ref callback to attach to the block's
 * outer View (react-native-web forwards it to the underlying DOM node).
 */
export function useAffiliateImpression(onImpression: () => void) {
  const firedRef = useRef(false)
  const disconnectRef = useRef<(() => void) | undefined>(undefined)
  const callbackRef = useRef(onImpression)
  callbackRef.current = onImpression

  const setRef = useCallback((node: unknown) => {
    disconnectRef.current?.()
    disconnectRef.current = undefined

    if (Platform.OS !== 'web' || !node || firedRef.current) return
    if (typeof IntersectionObserver === 'undefined') return

    const element = node as Element
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !firedRef.current) {
            firedRef.current = true
            callbackRef.current()
            observer.disconnect()
          }
        }
      },
      { threshold: 0.5 },
    )
    observer.observe(element)
    disconnectRef.current = () => observer.disconnect()
  }, [])

  useEffect(() => () => disconnectRef.current?.(), [])

  return setRef
}
