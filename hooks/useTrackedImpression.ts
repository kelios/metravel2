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
  const nodeRef = useRef<unknown>(null)
  const disconnectRef = useRef<(() => void) | undefined>(undefined)
  const callbackRef = useRef(onImpression)
  callbackRef.current = onImpression
  // Ключ, под который наблюдатель уже взведён. Сравнение с ним отличает смену
  // ключа от первого прохода эффекта на монтировании (#1498): раньше эффект
  // безусловно рвал наблюдатель, поставленный ref-колбэком двумя фазами
  // раньше, и показ не фиксировался вообще никогда — ноль `quest_card_impression`
  // при 26 кликах карточек за 30 дней.
  const armedKeyRef = useRef(impressionKey)

  const fireOnce = useCallback(() => {
    if (firedRef.current) return
    firedRef.current = true
    callbackRef.current()
  }, [])

  const observe = useCallback(() => {
    disconnectRef.current?.()
    disconnectRef.current = undefined

    const node = nodeRef.current
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

  const setRef = useCallback((node: unknown) => {
    nodeRef.current = node
    observe()
  }, [observe])

  useEffect(() => {
    if (armedKeyRef.current === impressionKey) return
    armedKeyRef.current = impressionKey
    firedRef.current = false
    // Узел тот же, а показ снова считается новым (карточка переиспользована под
    // другой контент), поэтому наблюдатель надо взвести заново вручную:
    // ref-колбэк на смену ключа не вызывается.
    observe()
  }, [impressionKey, observe])

  const onLayout = useCallback(() => {
    if (Platform.OS !== 'web') fireOnce()
  }, [fireOnce])

  useEffect(() => () => disconnectRef.current?.(), [])

  return { ref: setRef, onLayout }
}
