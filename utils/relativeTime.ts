import { formatRelativeTime as formatRelativeTimeValue, translate as i18nT } from '@/i18n'


const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export const formatRelativeTime = (timestamp: number, now: number = Date.now()): string => {
    if (!Number.isFinite(timestamp) || timestamp <= 0) return ''

    const diff = now - timestamp
    if (diff < 0) return i18nT('errors:utils.relativeTime.tolko_chto_175956e4')

    if (diff < MINUTE) return i18nT('errors:utils.relativeTime.tolko_chto_175956e4')

    if (diff < HOUR) {
        const minutes = Math.floor(diff / MINUTE)
        return formatRelativeTimeValue(-minutes, 'minute', { numeric: 'always' })
    }

    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)
    const startOfTodayMs = startOfToday.getTime()

    if (timestamp >= startOfTodayMs) {
        const hours = Math.floor(diff / HOUR)
        if (hours < 1) return i18nT('errors:utils.relativeTime.segodnya_097e1e0b')
        return formatRelativeTimeValue(-hours, 'hour', { numeric: 'always' })
    }

    const startOfYesterdayMs = startOfTodayMs - DAY
    if (timestamp >= startOfYesterdayMs) return formatRelativeTimeValue(-1, 'day', { numeric: 'auto' })

    const days = Math.ceil((startOfTodayMs - timestamp) / DAY)
    if (days < 7) {
        return formatRelativeTimeValue(-days, 'day', { numeric: 'always' })
    }

    if (days < 31) {
        const weeks = Math.floor(days / 7)
        return formatRelativeTimeValue(-weeks, 'week', { numeric: 'always' })
    }

    const months = Math.floor(days / 30)
    if (months < 12) {
        return formatRelativeTimeValue(-months, 'month', { numeric: 'always' })
    }

    const years = Math.floor(days / 365)
    return formatRelativeTimeValue(-years, 'year', { numeric: 'always' })
}
