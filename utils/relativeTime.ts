const getRussianPlural = (count: number, one: string, few: string, many: string) => {
    const absCount = Math.abs(count)
    const lastTwo = absCount % 100
    const last = absCount % 10

    if (lastTwo >= 11 && lastTwo <= 14) return many
    if (last === 1) return one
    if (last >= 2 && last <= 4) return few
    return many
}

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
        return `${minutes} ${getRussianPlural(minutes, 'минуту', 'минуты', 'минут')} назад`
    }

    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)
    const startOfTodayMs = startOfToday.getTime()

    if (timestamp >= startOfTodayMs) {
        const hours = Math.floor(diff / HOUR)
        if (hours < 1) return 'сегодня'
        return `${hours} ${getRussianPlural(hours, 'час', 'часа', 'часов')} назад`
    }

    const startOfYesterdayMs = startOfTodayMs - DAY
    if (timestamp >= startOfYesterdayMs) return 'вчера'

    const days = Math.round((startOfTodayMs - timestamp) / DAY)
    if (days < 7) {
        return `${days} ${getRussianPlural(days, 'день', 'дня', 'дней')} назад`
    }

    if (days < 31) {
        const weeks = Math.floor(days / 7)
        return `${weeks} ${getRussianPlural(weeks, 'неделю', 'недели', 'недель')} назад`
    }

    const months = Math.floor(days / 30)
    if (months < 12) {
        return `${months} ${getRussianPlural(months, 'месяц', 'месяца', 'месяцев')} назад`
    }

    const years = Math.floor(days / 365)
    return `${years} ${getRussianPlural(years, 'год', 'года', 'лет')} назад`
}
