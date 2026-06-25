import { useCallback, useEffect, useRef } from 'react'
import { Platform } from 'react-native'

/**
 * FE-3: fire an impression callback once when the affiliate block is observed.
 * Web uses IntersectionObserver (≥50% visible); native uses first layout as a
 * lightweight visibility proxy because there is no DOM observer.
 */
export function useAffiliateImpression(onImpression: () => void) {
  const firedRef = useRef(false)
  const disconnectRef = useRef<(() => void) | undefined>(undefined)
  const callbackRef = useRef(onImpression)
  callbackRef.current = onImpression

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

    const element = node as Element
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !firedRef.current) {
            fireOnce()
            observer.disconnect()
          }
        }
      },
      { threshold: 0.5 },
    )
    observer.observe(element)
    disconnectRef.current = () => observer.disconnect()
  }, [fireOnce])

  const onLayout = useCallback(() => {
    if (Platform.OS === 'web') return
    fireOnce()
  }, [fireOnce])

  useEffect(() => () => disconnectRef.current?.(), [])

  return { ref: setRef, onLayout }
}
