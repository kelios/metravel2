// utils/routePointDay.ts
// #1845: день похода у точки маршрута. Разбор и payload живут здесь, а не в
// компоненте: те же правила нужны нормализатору ответа и PUT маршрута, а слой
// `api/` не импортирует `components/`. Группировка списка и заголовок дня —
// этажом выше, в `components/trips/planning/routePointDays.ts`.
import type { RoutePoint } from '@/api/plannedTripsTypes'
import { translate as i18nT } from '@/i18n'

/** Контракт бэкенда #1841: 1–60 включительно или null. */
export const MIN_ROUTE_DAY = 1
export const MAX_ROUTE_DAY = 60

const isAllowedDay = (value: number): boolean =>
  Number.isInteger(value) && value >= MIN_ROUTE_DAY && value <= MAX_ROUTE_DAY

/**
 * День из ответа бэкенда. Мусор и значения вне 1–60 не становятся «днём 0»:
 * точка остаётся без дня, как после миграции существующих маршрутов.
 */
export const dayNumberFromBe = (raw: unknown): number | null => {
  if (typeof raw === 'number' && isAllowedDay(raw)) return raw
  if (typeof raw === 'string' && /^-?\d+$/.test(raw.trim())) {
    const parsed = Number(raw.trim())
    if (isAllowedDay(parsed)) return parsed
  }
  return null
}

export const pointDayNumber = (point: Pick<RoutePoint, 'dayNumber'>): number | null =>
  typeof point.dayNumber === 'number' && isAllowedDay(point.dayNumber) ? point.dayNumber : null

/**
 * Черновик поля «День похода». Пустая строка — точка без дня, это штатный
 * случай однодневной поездки. Дробь, ноль и 61 — ошибка, а не молчаливый null:
 * иначе введённая «8» при опечатке «80» исчезла бы без объяснения.
 */
export const parseRouteDayDraft = (
  raw: string,
): { dayNumber: number | null; error: string | null } => {
  const value = raw.trim()
  if (!value) return { dayNumber: null, error: null }
  if (!/^\d+$/.test(value)) {
    return { dayNumber: null, error: i18nT('tripsStatic:plan.routeDay.errors.range') }
  }
  const parsed = Number(value)
  if (!isAllowedDay(parsed)) {
    return { dayNumber: null, error: i18nT('tripsStatic:plan.routeDay.errors.range') }
  }
  return { dayNumber: parsed, error: null }
}

/**
 * PUT маршрута атомарный: пропуск `day_number` на бэкенде обнуляет день
 * (#1841, omission on full replacement → null). Поэтому ключ уходит всегда.
 */
export const dayNumberPayload = (
  point: Pick<RoutePoint, 'dayNumber'>,
): { day_number: number | null } => ({
  day_number: pointDayNumber(point),
})
