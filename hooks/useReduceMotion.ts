import { useEffect, useState } from 'react'
import { AccessibilityInfo, Platform } from 'react-native'

/**
 * Системная настройка «уменьшить движение» (web — `prefers-reduced-motion`,
 * native — настройка ОС). До ответа ОС считаем, что движение разрешено:
 * так первый кадр совпадает со статическим HTML.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false)

  useEffect(() => {
    let alive = true
    try {
      AccessibilityInfo.isReduceMotionEnabled?.()
        .then((value) => {
          if (alive) setReduce(!!value)
        })
        .catch(() => undefined)
    } catch {
      // старый runtime без API — движение остаётся разрешённым
    }
    let subscription: { remove?: () => void } | undefined
    try {
      subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (value: boolean) => {
        if (alive) setReduce(!!value)
      }) as { remove?: () => void } | undefined
    } catch {
      subscription = undefined
    }
    return () => {
      alive = false
      subscription?.remove?.()
    }
  }, [])

  return reduce
}

/** `useNativeDriver` разрешён только на native: на web Animated рисует через JS. */
export const ANIMATION_NATIVE_DRIVER = Platform.OS !== 'web'
