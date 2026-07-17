import {
    formatRelativeTime as formatRelativeTimeValue,
    selectPlural,
    translate as i18nT,
} from '@/i18n'


const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

type SupportedRelativeTimeUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'

const RELATIVE_TIME_UNIT_KEYS = {
    minute: {
        one: 'errors:utils.relativeTime.units.minute_one',
        few: 'errors:utils.relativeTime.units.minute_few',
        many: 'errors:utils.relativeTime.units.minute_many',
        other: 'errors:utils.relativeTime.units.minute_other',
    },
    hour: {
        one: 'errors:utils.relativeTime.units.hour_one',
        few: 'errors:utils.relativeTime.units.hour_few',
        many: 'errors:utils.relativeTime.units.hour_many',
        other: 'errors:utils.relativeTime.units.hour_other',
    },
    day: {
        one: 'errors:utils.relativeTime.units.day_one',
        few: 'errors:utils.relativeTime.units.day_few',
        many: 'errors:utils.relativeTime.units.day_many',
        other: 'errors:utils.relativeTime.units.day_other',
    },
    week: {
        one: 'errors:utils.relativeTime.units.week_one',
        few: 'errors:utils.relativeTime.units.week_few',
        many: 'errors:utils.relativeTime.units.week_many',
        other: 'errors:utils.relativeTime.units.week_other',
    },
    month: {
        one: 'errors:utils.relativeTime.units.month_one',
        few: 'errors:utils.relativeTime.units.month_few',
        many: 'errors:utils.relativeTime.units.month_many',
        other: 'errors:utils.relativeTime.units.month_other',
    },
    year: {
        one: 'errors:utils.relativeTime.units.year_one',
        few: 'errors:utils.relativeTime.units.year_few',
        many: 'errors:utils.relativeTime.units.year_many',
        other: 'errors:utils.relativeTime.units.year_other',
    },
} as const

const formatPastRelativeTime = (
    value: number,
    unit: SupportedRelativeTimeUnit,
    options: Intl.RelativeTimeFormatOptions = { numeric: 'always' },
): string => {
    if (typeof Intl.RelativeTimeFormat === 'function') {
        return formatRelativeTimeValue(value, unit, options)
    }

    if (unit === 'day' && value === -1 && options.numeric === 'auto') {
        return i18nT('errors:utils.relativeTime.vchera_bfce6d7a')
    }

    const count = Math.abs(value)
    const keys = RELATIVE_TIME_UNIT_KEYS[unit]
    const unitLabel = selectPlural(count, {
        one: i18nT(keys.one),
        few: i18nT(keys.few),
        many: i18nT(keys.many),
        other: i18nT(keys.other),
    })

    return i18nT('errors:utils.relativeTime.value1_value2_nazad_75a981f6', {
        value1: count,
        value2: unitLabel,
    })
}

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
