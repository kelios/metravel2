import { useEffect, useRef, useState } from 'react'
import { AppState, Platform } from 'react-native'

import { subscribeAppResume } from '@/utils/appResume'
import { millisecondsUntilLocalMidnight } from '@/utils/seasonalThemeClock'

type Options = {
  /** Источник «сейчас»; по умолчанию системные часы. Адвент подставляет DEV-переопределение даты. */
  readNow?: () => Date
}

const systemNow = () => new Date()

const isSameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

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
      // #3467: тот же календарный день — прежний объект. Новый Date на каждом
      // монтировании менял контекст темы над ещё не гидратированными границами,
      // и React догидратировал всю страницу синхронно (в том числе внутри тапа).
      setNow((previous) => (isSameLocalDay(previous, current) ? previous : current))
      if (isWeb || appState == null || appState === 'active') {
        midnightTimer = setTimeout(refresh, millisecondsUntilLocalMidnight(current))
      }
    }
    refresh()
    const unsubscribe = subscribeAppResume({
      onResume: () => {
        if (!isWeb) appState = 'active'
        refresh()
      },
      // На web скрытая вкладка таймер не снимает; native в фоне таймер не держит.
      onPause: isWeb
        ? undefined
        : () => {
            appState = 'background'
            clearTimeout(midnightTimer)
          },
    })
    return () => {
      clearTimeout(midnightTimer)
      unsubscribe()
    }
  }, [])

  return now
}
