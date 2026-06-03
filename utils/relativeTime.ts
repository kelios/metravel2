import { pluralizeRu } from './pluralize'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export const formatRelativeTime = (timestamp: number, now: number = Date.now()): string => {
    if (!Number.isFinite(timestamp) || timestamp <= 0) return ''

    const diff = now - timestamp
    if (diff < 0) return 'только что'

    if (diff < MINUTE) return 'только что'

    if (diff < HOUR) {
        const minutes = Math.floor(diff / MINUTE)
        return `${minutes} ${pluralizeRu(minutes, 'минуту', 'минуты', 'минут')} назад`
    }

    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)
    const startOfTodayMs = startOfToday.getTime()

    if (timestamp >= startOfTodayMs) {
        const hours = Math.floor(diff / HOUR)
        if (hours < 1) return 'сегодня'
        return `${hours} ${pluralizeRu(hours, 'час', 'часа', 'часов')} назад`
    }

    const startOfYesterdayMs = startOfTodayMs - DAY
    if (timestamp >= startOfYesterdayMs) return 'вчера'

    const days = Math.ceil((startOfTodayMs - timestamp) / DAY)
    if (days < 7) {
        return `${days} ${pluralizeRu(days, 'день', 'дня', 'дней')} назад`
    }

    if (days < 31) {
        const weeks = Math.floor(days / 7)
        return `${weeks} ${pluralizeRu(weeks, 'неделю', 'недели', 'недель')} назад`
    }

    const months = Math.floor(days / 30)
    if (months < 12) {
        return `${months} ${pluralizeRu(months, 'месяц', 'месяца', 'месяцев')} назад`
    }

    const years = Math.floor(days / 365)
    return `${years} ${pluralizeRu(years, 'год', 'года', 'лет')} назад`
}
