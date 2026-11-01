import { memo, useEffect, useState } from 'react'
import { StyleSheet, Text } from 'react-native'

import { useThemedColors } from '@/hooks/useTheme'
import { formatRelativeTime } from '@/i18n/format'
import { translate as i18nT } from '@/i18n'
import type { AdventDoorView } from '@/hooks/useAdventCampaign'
import { millisecondsUntilDoor } from '@/utils/advent/adventCalendar'
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

/** «через 5 часов» / «через 3 дня» — Intl.RelativeTimeFormat языка интерфейса. */
export const formatUntil = (ms: number): string => {
  if (ms >= DAY) return formatRelativeTime(Math.ceil(ms / DAY), 'day', { numeric: 'always' })
  if (ms >= HOUR) return formatRelativeTime(Math.ceil(ms / HOUR), 'hour', { numeric: 'always' })
  return formatRelativeTime(Math.max(1, Math.ceil(ms / MINUTE)), 'minute', { numeric: 'always' })
}

function AdventCountdown({ nextDoor, now, hydrated }: Props) {
  const colors = useThemedColors()
  // Тикаем от `now` хука, а не от `Date.now()`: иначе DEV-переопределение даты
  // показывало бы «через 33 дня» для завтрашней дверцы.
  const [elapsed, setElapsed] = useState(0)

  const nextDay = nextDoor?.day ?? null
  useEffect(() => {
    setElapsed(0)
    if (nextDay === null || !hydrated) return
    const startedAt = Date.now()
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), MINUTE)
    return () => clearInterval(timer)
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
