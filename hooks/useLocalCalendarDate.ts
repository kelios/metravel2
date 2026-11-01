import { useEffect, useRef, useState } from 'react'
import { AppState, Platform } from 'react-native'

import { millisecondsUntilLocalMidnight } from '@/utils/seasonalThemeClock'

type Options = {
  /** Источник «сейчас»; по умолчанию системные часы. Адвент подставляет DEV-переопределение даты. */
  readNow?: () => Date
}

const systemNow = () => new Date()

/**
 * Местная календарная дата с пересчётом по гражданской полуночи (23/25-часовые
 * сутки DST), на возврат вкладки (visibilitychange/focus/pageshow) и на AppState
 * `active`; в фоне native таймер не держится. Единый источник для сезонной темы
 * (`hooks/useTheme.ts`) и адвент-календаря (`hooks/useAdventCampaign.ts`).
 */
export function useLocalCalendarDate({ readNow = systemNow }: Options = {}): Date {
  const [now, setNow] = useState(() => readNow())
  // Источник «сейчас» читается через ref: подписки ставятся один раз, без перезапуска эффекта.
  const readNowRef = useRef(readNow)
  readNowRef.current = readNow

  useEffect(() => {
    const isWeb = Platform.OS === 'web'
    if (isWeb && (typeof document === 'undefined' || typeof window === 'undefined')) return
    let midnightTimer: ReturnType<typeof setTimeout> | undefined
    let appState = isWeb ? null : AppState.currentState
    const refresh = () => {
      clearTimeout(midnightTimer)
      const current = readNowRef.current()
      setNow(current)
      if (isWeb || appState == null || appState === 'active') {
        midnightTimer = setTimeout(refresh, millisecondsUntilLocalMidnight(current))
      }
    }
    refresh()
    if (!isWeb) {
      const subscription = AppState.addEventListener('change', (nextState) => {
        appState = nextState
        if (nextState === 'active') refresh()
        else clearTimeout(midnightTimer)
      })
      return () => {
        clearTimeout(midnightTimer)
        subscription.remove()
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    return () => {
      clearTimeout(midnightTimer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
    }
  }, [])

  return now
}
