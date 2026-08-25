import {
    formatRelativeTime as formatRelativeTimeValue,
    translate as i18nT,
} from '@/i18n'


const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

type SupportedRelativeTimeUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'

/**
 * Относительное время для этой утилиты всегда в прошлом и по умолчанию
 * числовое («5 минут назад»), тогда как канонический `formatRelativeTime`
 * (`i18n/format.ts`) по умолчанию словесный («вчера»).
 *
 * Своей проверки на отсутствующий `Intl.RelativeTimeFormat` здесь больше нет:
 * с #1528 защита и локализованный fallback живут в самом каноническом
 * экспорте, и третья копия той же проверки на очередном месте вызова только
 * расходилась бы с ним.
 */
const formatPastRelativeTime = (
    value: number,
    unit: SupportedRelativeTimeUnit,
    options: Intl.RelativeTimeFormatOptions = { numeric: 'always' },
): string => formatRelativeTimeValue(value, unit, options)

export const formatRelativeTime = (timestamp: number, now: number = Date.now()): string => {
    if (!Number.isFinite(timestamp) || timestamp <= 0) return ''

    const diff = now - timestamp
    if (diff < 0) return i18nT('errors:utils.relativeTime.tolko_chto_175956e4')

    if (diff < MINUTE) return i18nT('errors:utils.relativeTime.tolko_chto_175956e4')

    if (diff < HOUR) {
        const minutes = Math.floor(diff / MINUTE)
        return formatPastRelativeTime(-minutes, 'minute')
    }

    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)
    const startOfTodayMs = startOfToday.getTime()

    if (timestamp >= startOfTodayMs) {
        const hours = Math.floor(diff / HOUR)
        if (hours < 1) return i18nT('errors:utils.relativeTime.segodnya_097e1e0b')
        return formatPastRelativeTime(-hours, 'hour')
    }

    const startOfYesterdayMs = startOfTodayMs - DAY
    if (timestamp >= startOfYesterdayMs) return formatPastRelativeTime(-1, 'day', { numeric: 'auto' })

    const days = Math.ceil((startOfTodayMs - timestamp) / DAY)
    if (days < 7) {
        return formatPastRelativeTime(-days, 'day')
    }

    if (days < 31) {
        const weeks = Math.floor(days / 7)
        return formatPastRelativeTime(-weeks, 'week')
    }

    const months = Math.floor(days / 30)
    if (months < 12) {
        return formatPastRelativeTime(-months, 'month')
    }

    const years = Math.floor(days / 365)
    return formatPastRelativeTime(-years, 'year')
}
