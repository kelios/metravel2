// components/trips/planning/routePointDays.ts
// #1845: группировка точек конструктора по дню похода. Чистые функции без
// React: их зовут и секция списка, и тесты, и заголовок группы.
import type { RoutePoint } from '@/api/plannedTrips'
import { MAX_ROUTE_DAY, pointDayNumber } from '@/utils/routePointDay'
import { haversineKm } from '@/utils/geo'
import { addCalendarDays } from '@/utils/tripDateTime'

export type RouteDayGroup = {
  /** `null` — точки без дня, всегда последняя группа. */
  dayNumber: number | null
  /** Индексы в исходном массиве маршрута, в его порядке. */
  indices: number[]
}

/** Есть хотя бы одна размеченная точка — иначе список остаётся плоским. */
export const shouldGroupRouteByDay = (route: readonly RoutePoint[]): boolean =>
  route.some((point) => pointDayNumber(point) != null)

export const usedRouteDays = (route: readonly RoutePoint[]): number[] => {
  const days = new Set<number>()
  for (const point of route) {
    const day = pointDayNumber(point)
    if (day != null) days.add(day)
  }
  return [...days].sort((left, right) => left - right)
}

/**
 * Чипы выбора дня: уже занятые дни маршрута плюс следующий свободный, чтобы
 * назначить «день 4», не набирая число. «Без дня» рисует сама форма.
 */
export const routeDayChipValues = (route: readonly RoutePoint[]): number[] => {
  const used = usedRouteDays(route)
  const next = (used[used.length - 1] ?? 0) + 1
  return next <= MAX_ROUTE_DAY ? [...used, next] : used
}

export const groupRoutePointsByDay = (route: readonly RoutePoint[]): RouteDayGroup[] => {
  const byDay = new Map<number, number[]>()
  const unassigned: number[] = []
  route.forEach((point, index) => {
    const day = pointDayNumber(point)
    if (day == null) {
      unassigned.push(index)
      return
    }
    const bucket = byDay.get(day)
    if (bucket) bucket.push(index)
    else byDay.set(day, [index])
  })
  const groups: RouteDayGroup[] = [...byDay.keys()]
    .sort((left, right) => left - right)
    .map((dayNumber) => ({ dayNumber, indices: byDay.get(dayNumber) ?? [] }))
  if (unassigned.length) groups.push({ dayNumber: null, indices: unassigned })
  return groups
}

/**
 * Сумма прямых отрезков между соседними точками группы. Это тот же haversine,
 * что считает расстояние между двумя координатами в домене, применённый к
 * подмножеству дня — не сводка ORS всего маршрута.
 */
export const routePointsDistanceKm = (
  points: ReadonlyArray<Pick<RoutePoint, 'coordinates'>>,
): number => {
  let total = 0
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]?.coordinates
    const current = points[index]?.coordinates
    if (
      !previous ||
      !current ||
      !Number.isFinite(previous[0]) ||
      !Number.isFinite(previous[1]) ||
      !Number.isFinite(current[0]) ||
      !Number.isFinite(current[1])
    ) {
      continue
    }
    total += haversineKm(previous[1], previous[0], current[1], current[0])
  }
  return total
}

export const dayGroupDistanceKm = (
  route: readonly RoutePoint[],
  indices: readonly number[],
): number => routePointsDistanceKm(indices.map((index) => route[index]).filter(Boolean))

/** Календарный день похода: старт поездки + (номер дня − 1). */
export const hikeDayDate = (
  startDate: string | null | undefined,
  dayNumber: number,
): string | null => {
  if (!Number.isInteger(dayNumber) || dayNumber < 1) return null
  return addCalendarDays(startDate, dayNumber - 1)
}
