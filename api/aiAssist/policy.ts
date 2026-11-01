/**
 * Числа политики ассистента (#2460, #2711, #2713), общие для клиента и сервера.
 *
 * Клиент (`limits.ts`, AsyncStorage) показывает «осталось вопросов» и «не по теме
 * N из 3», сервер `/ai/ask` (`scripts/ai-assist/limits.ts`, redis) решает по тем
 * же числам — экран и сервер не расходятся. Модуль без импортов: его читает и
 * Node-сервис metravel-assist.
 */

/** Вопросов в сутки на устройство (клиент) и на IP (сервер). */
export const AI_ASK_DAILY_LIMIT = 20
/** Третий вопрос не по теме за календарный день закрывает ассистент до полуночи (решение владельца 25.10.2026). */
export const AI_OFFTOPIC_STRIKES_TO_BLOCK = 3
/** Карточек подбора в промпте. */
export const AI_SOURCES_LIMIT = 8
/** День лимитов и блока на сервере — календарный по этой зоне (аудитория сайта), `AI_ASSIST_DAY_TZ` переопределяет. */
export const AI_ASK_DAY_TIME_ZONE = 'Europe/Minsk'

const SECONDS_PER_DAY = 86_400

/**
 * Секунд до конца календарного дня в зоне сервера — срок, на который экран держит
 * «лимит исчерпан», когда сервер сообщил `remaining: 0` без `Retry-After` (#2884).
 * Без поддержки зоны в `Intl` (старый Hermes) — полночь по часам устройства.
 */
export const secondsToDayEnd = (now: Date = new Date(), timeZone: string = AI_ASK_DAY_TIME_ZONE): number => {
  let hour = now.getHours()
  let minute = now.getMinutes()
  let second = now.getSeconds()
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(now)
    const read = (type: string) => Number(parts.find((part) => part.type === type)?.value)
    const [h, m, s] = [read('hour'), read('minute'), read('second')]
    if ([h, m, s].every(Number.isFinite)) [hour, minute, second] = [h % 24, m, s]
  } catch {
    // Зона недоступна — остаёмся на локальном времени.
  }
  return Math.max(1, SECONDS_PER_DAY - (hour * 3600 + minute * 60 + second))
}
