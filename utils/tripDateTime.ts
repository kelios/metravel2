// utils/tripDateTime.ts
// Единственная точка интерпретации дат домена trips (#1313).
//
// Бэкенд отдаёт `start_date`/`start_at` как ISO 8601 date-time со смещением;
// date-only остаётся допустимым legacy-значением. Раньше три разных места
// разбирали эту строку по регулярке `^\d{4}-\d{2}-\d{2}$` и при несовпадении
// возвращали вход как есть — так на экран попадал сырой ISO.
//
// Модуль живёт в `utils/`, а не в `components/trips/`, потому что его импортируют
// нормализаторы `api/*`, а слой API не может зависеть от компонентов.

import { translate as i18nT } from '@/i18n'
import { formatDate } from '@/i18n/format'

export interface TripDateTime {
  /** Календарный день устройства, `YYYY-MM-DD`. Готов для date-input и пикера. */
  readonly date: string
  /** Локальное время `HH:mm` устройства или null, если в источнике времени не было. */
  readonly time: string | null
  /** Точный момент для date-time; локальная полночь для date-only. */
  readonly value: Date
  /**
   * true, когда источник нёс явное время суток. Отдельный флаг, а не вывод из
   * `time === null`, потому что контракт различает «в payload времени не было»
   * и «время не удалось прочитать»; второе даёт null целиком.
   */
  readonly hasTime: boolean
}

/** Длиннее этого не бывает валидного ISO-значения; отсекаем до разбора. */
const MAX_INPUT_LENGTH = 40

// Капчурящие группы = извлечение частей = разбор. Он допустим только здесь:
// `__tests__/trips/tripDateGovernance.test.ts` запрещает вторую копию.
// Анкерная проверка формы ввода без групп (`/^\d{4}-\d{2}-\d{2}$/`) — это
// валидация того, что набрал пользователь, и она остаётся в формах.
//
// Принимаемые формы смещения: `Z`, `±HH:MM`, `±HHMM` и часовая `±HH` — DRF
// сейчас отдаёт `±HH:MM`, но узкий allowlist превратил бы смену сериализатора
// на бэке в тихое «Дата не указана» сразу на пяти поверхностях.
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}(?::?\d{2})?)?$/i

const LONG_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
const SHORT_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }

const pad2 = (value: number): string => String(value).padStart(2, '0')

const toLocalDate = (value: Date): string =>
  `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`

const toLocalTime = (value: Date): string =>
  `${pad2(value.getHours())}:${pad2(value.getMinutes())}`

/** Существует ли такой календарный день (ловит 30 февраля и 45-е число). */
const isRealCalendarDay = (year: number, month: number, day: number): boolean => {
  const probe = new Date(Date.UTC(year, month - 1, day))
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  )
}

/**
 * Локальная дата из компонентов. Проверяем именно календарь (30 февраля),
 * а не round-trip часов: в момент перехода на летнее время несуществующий
 * час законно сдвигается, и это не повод считать значение битым.
 */
const localFromParts = (
  year: number,
  month: number,
  day: number,
  hours = 0,
  minutes = 0,
  seconds = 0,
): Date | null => {
  if (hours > 23 || minutes > 59 || seconds > 59) return null
  const value = new Date(year, month - 1, day, hours, minutes, seconds, 0)
  if (
    value.getFullYear() !== year ||
    value.getMonth() !== month - 1 ||
    value.getDate() !== day
  ) {
    return null
  }
  return value
}

/**
 * Разобрать значение даты поездки. Возвращает null, когда значение прочитать
 * нельзя — вызывающая сторона обязана показать unavailable-состояние, а не
 * сам вход.
 */
export function parseTripDateTime(input: string | null | undefined): TripDateTime | null {
  if (typeof input !== 'string') return null
  const raw = input.trim()
  if (!raw || raw.length > MAX_INPUT_LENGTH) return null

  const dateOnly = DATE_ONLY.exec(raw)
  if (dateOnly) {
    const value = localFromParts(
      Number(dateOnly[1]),
      Number(dateOnly[2]),
      Number(dateOnly[3]),
    )
    if (!value) return null
    // Календарный день без времени: строим по локальным компонентам, поэтому
    // он никогда не уезжает на сутки из-за UTC-полуночи `new Date('2026-10-12')`.
    return { date: raw, time: null, value, hasTime: false }
  }

  const dateTime = DATE_TIME.exec(raw)
  if (!dateTime) return null

  const [, year, month, day, hours, minutes, seconds, offset] = dateTime
  const hh = Number(hours)
  const mm = Number(minutes)
  const ss = seconds ? Number(seconds) : 0

  if (!offset) {
    // Legacy-значение без смещения: это стенные часы устройства — ровно та
    // форма, которую до сих пор писал наш собственный клиент.
    const value = localFromParts(Number(year), Number(month), Number(day), hh, mm, ss)
    if (!value) return null
    return { date: toLocalDate(value), time: toLocalTime(value), value, hasTime: true }
  }

  if (hh > 23 || mm > 59 || ss > 59) return null
  // `new Date('2026-02-30T09:00:00Z')` не падает, а молча переносит на 2 марта,
  // поэтому календарь проверяем сами — иначе битая дата станет валидным моментом.
  if (!isRealCalendarDay(Number(year), Number(month), Number(day))) return null
  const normalizedOffset =
    offset.toUpperCase() === 'Z'
      ? 'Z'
      : offset.length === 3
        ? `${offset}:00`
        : offset.includes(':')
          ? offset
          : `${offset.slice(0, 3)}:${offset.slice(3)}`
  const instant = new Date(
    `${year}-${month}-${day}T${pad2(hh)}:${pad2(mm)}:${pad2(ss)}${normalizedOffset}`,
  )
  if (Number.isNaN(instant.getTime())) return null
  return {
    date: toLocalDate(instant),
    time: toLocalTime(instant),
    value: instant,
    hasTime: true,
  }
}

/** Read-only плейсхолдер: дата неизвестна. Это не приглашение «Выберите дату». */
export function tripDateUnavailableText(): string {
  return i18nT('tripsStatic:plan.dateUnavailable')
}

/** «11 июля 2026 г.» */
export function formatTripDateLong(input: string | null | undefined): string {
  const parsed = parseTripDateTime(input)
  if (!parsed) return tripDateUnavailableText()
  return formatDate(parsed.value, LONG_DATE)
}

/**
 * «11 июля 2026 г., 08:00». Время берётся из явного аргумента, а если его нет —
 * из самого значения, чтобы ещё не нормализованный date-time не мог напечататься сырым.
 */
export function formatTripDateTimeLong(
  input: string | null | undefined,
  time: string | null | undefined,
): string {
  const parsed = parseTripDateTime(input)
  if (!parsed) return tripDateUnavailableText()
  const base = formatDate(parsed.value, LONG_DATE)
  const effectiveTime = time?.trim() || parsed.time
  return effectiveTime ? `${base}, ${effectiveTime}` : base
}

/** «18 июл. – 20 июл.» / «28 июн.» */
export function formatTripDateRangeShort(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const from = parseTripDateTime(start)
  if (!from) return tripDateUnavailableText()
  const to = parseTripDateTime(end)
  const startText = formatDate(from.value, SHORT_DATE)
  if (!to || to.date === from.date) return startText
  return `${startText} – ${formatDate(to.value, SHORT_DATE)}`
}

/**
 * Payload старта поездки с явным смещением устройства.
 *
 * Раньше клиент слал `YYYY-MM-DDTHH:mm:00` без смещения, а бэкенд читает такое
 * значение как UTC — сохранённый момент уезжал на величину offset.
 *
 * Строка собирается из уже разрешённых частей, а не из сырого ввода: в час
 * перехода на летнее время выбранных стенных часов не существует, движок
 * сдвигает момент, и пара «сырые часы + смещение разрешённого момента»
 * означала бы совсем другое время.
 *
 * Бросает на нечитаемом значении: молча отдать payload без смещения — это та
 * самая потеря данных, ради которой задача и делалась.
 */
export function serializeTripStart(date: string, time: string | null | undefined): string {
  const parsed = parseTripDateTime(`${date}T${time?.trim() || '09:00'}:00`)
  if (!parsed?.time) {
    throw new Error(`serializeTripStart: unreadable trip start "${date}"`)
  }
  const offsetMinutes = -parsed.value.getTimezoneOffset()
  const sign = offsetMinutes < 0 ? '-' : '+'
  const abs = Math.abs(offsetMinutes)
  return `${parsed.date}T${parsed.time}:00${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`
}
