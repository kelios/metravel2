import { memo, useEffect, useState } from 'react'
import { StyleSheet, Text } from 'react-native'

import { readDevTodayOverride } from '@/constants/advent'
import { useThemedColors } from '@/hooks/useTheme'
import { formatRelativeTime } from '@/i18n/format'
import { translate as i18nT } from '@/i18n'
import type { AdventDoorView } from '@/hooks/useAdventCampaign'
import { millisecondsUntilDoor } from '@/utils/advent/adventCalendar'
import { subscribeAppResume } from '@/utils/appResume'
import { formatDoorDate } from './AdventDoorTile'

type Props = {
  nextDoor: AdventDoorView | null
  /** Местное «сейчас» кампании (учитывает DEV-переопределение `?today=`); отсчёт тикает от него. */
  now: Date
  /** До гидратации на web — дата дверцы вместо относительного времени (детерминированный HTML). */
  hydrated: boolean
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * Сколько прошло от базового «сейчас» хука кампании. #3467: в течение дня хук
 * отдаёт один и тот же объект Date, поэтому отсчёт идёт от часов, а не от момента
 * своего монтирования (иначе шторка, открытая вечером, считала бы от утра).
 * DEV-подмена `?today=` даёт фиктивный полдень: тогда тикаем от старта отсчёта,
 * иначе завтрашняя дверца показывала бы «через 33 дня».
 */
const elapsedSince = (now: Date, startedAt: number): number =>
  readDevTodayOverride() ? Date.now() - startedAt : Math.max(0, Date.now() - now.getTime())

/** «через 5 часов» / «через 3 дня» — Intl.RelativeTimeFormat языка интерфейса. */
export const formatUntil = (ms: number): string => {
  if (ms >= DAY) return formatRelativeTime(Math.ceil(ms / DAY), 'day', { numeric: 'always' })
  if (ms >= HOUR) return formatRelativeTime(Math.ceil(ms / HOUR), 'hour', { numeric: 'always' })
  return formatRelativeTime(Math.max(1, Math.ceil(ms / MINUTE)), 'minute', { numeric: 'always' })
}

function AdventCountdown({ nextDoor, now, hydrated }: Props) {
  const colors = useThemedColors()
  const [elapsed, setElapsed] = useState(() => (hydrated ? elapsedSince(now, Date.now()) : 0))

  const nextDay = nextDoor?.day ?? null
  useEffect(() => {
    if (nextDay === null || !hydrated) {
      setElapsed(0)
      return
    }
    const startedAt = Date.now()
    const tick = () => setElapsed(elapsedSince(now, startedAt))
    tick()
    const timer = setInterval(tick, MINUTE)
    // Таймер в фоне заморожен: на возврат во вкладку/приложение догоняем часы сразу.
    const unsubscribe = subscribeAppResume({ onResume: tick })
    return () => {
      clearInterval(timer)
      unsubscribe()
    }
    // Перезапуск только при смене дня дверцы или базового «сейчас», не объекта дверцы.
  }, [nextDay, now, hydrated])

  const text = nextDoor
    ? i18nT('adventStatic:countdown.next', {
        value1: nextDoor.day,
        value2: hydrated
          ? formatUntil(millisecondsUntilDoor(nextDoor, new Date(now.getTime() + elapsed)))
          : formatDoorDate(nextDoor.date),
      })
    : i18nT('adventStatic:countdown.allOpen')

  return (
    <Text testID="advent-countdown" accessibilityLiveRegion="polite" style={[styles.text, { color: colors.textSecondary }]}>
      {text}
    </Text>
  )
}

const styles = StyleSheet.create({
  text: { fontSize: 14, lineHeight: 20 },
})

export default memo(AdventCountdown)
