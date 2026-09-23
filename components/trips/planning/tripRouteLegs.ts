// components/trips/planning/tripRouteLegs.ts
// #2056: отрезки маршрута плана — прогоны, которые прокладывает движок, и
// переезды (поезд, перелёт, автобус, паром, трансфер), которые не прокладываются.
// Разбиение повторяет бэкенд #2055 (`trips/route_legs.py::split_route_legs` и
// `_summary_for_route_points`): превью и карта режут маршрут там же, где режет
// сохранённая сводка, иначе после сохранения линия и цифры прыгали бы.
// Модуль чистый — ни React, ни Leaflet: его читают превью, обе карты и jest.
import type { RouteGeometry, RouteLeg, RoutePoint, RoutePointArrivalMode } from '@/api/plannedTrips'
import { routePointsDistanceKm } from './routePointDays'

type LngLat = [number, number]

/** Прогон: точки с координатами между переездами. Меньше двух — бэкенд его пропускает. */
export interface RouteRunSegment {
  kind: 'route'
  /** Первая и последняя точки прогона с координатами (индексы в `route`). */
  fromIndex: number
  toIndex: number
  points: LngLat[]
}

/** Переезд от точки `fromIndex` (= `toIndex − 1`) к точке со способом прибытия. */
export interface RouteTransferSegment {
  kind: 'transfer'
  mode: RoutePointArrivalMode
  fromIndex: number
  toIndex: number
  /** `null` — у конца нет координат: бэкенд пишет 0 км и пустую геометрию. */
  line: [LngLat, LngLat] | null
  distanceKm: number
}

export type RouteSegment = RouteRunSegment | RouteTransferSegment

const pointLngLat = (point: RoutePoint | undefined): LngLat | null => {
  const coordinates = point?.coordinates
  return Array.isArray(coordinates) && Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1])
    ? [coordinates[0], coordinates[1]]
    : null
}

/**
 * Отрезки маршрута по порядку. Точка `i ≥ 1` со способом прибытия закрывает
 * прогон `[start, i)` и даёт переезд `i − 1 → i`; следующий прогон начинается с
 * неё же. Способ у первой точки не читается: предыдущей у неё нет. Длина
 * переезда — по прямой между двумя точками, так её меряет и бэкенд
 * (`_route_distance_m`); это определение переезда, а не оценка дороги.
 */
export function splitRouteSegments(route: readonly RoutePoint[]): RouteSegment[] {
  const segments: RouteSegment[] = []
  const pushRun = (start: number, end: number) => {
    const indices: number[] = []
    const points: LngLat[] = []
    for (let index = start; index < end; index += 1) {
      const lngLat = pointLngLat(route[index])
      if (!lngLat) continue
      indices.push(index)
      points.push(lngLat)
    }
    if (points.length < 2) return
    segments.push({ kind: 'route', fromIndex: indices[0], toIndex: indices[indices.length - 1], points })
  }
  let start = 0
  for (let index = 1; index < route.length; index += 1) {
    const mode = route[index]?.arrivalMode
    if (!mode) continue
    pushRun(start, index)
    const from = pointLngLat(route[index - 1])
    const to = pointLngLat(route[index])
    segments.push({
      kind: 'transfer',
      mode,
      fromIndex: index - 1,
      toIndex: index,
      line: from && to ? [from, to] : null,
      distanceKm: from && to ? routePointsDistanceKm([route[index - 1], route[index]]) : 0,
    })
    start = index
  }
  pushRun(start, route.length)
  return segments
}

export const hasTransferSegment = (segments: readonly RouteSegment[]): boolean =>
  segments.some((segment) => segment.kind === 'transfer')

/** Переезды по индексу точки назначения — для плашки над точкой в списке. */
export const transfersByPointIndex = (route: readonly RoutePoint[]): Map<number, RouteTransferSegment> =>
  new Map(
    splitRouteSegments(route).flatMap((segment): Array<[number, RouteTransferSegment]> =>
      segment.kind === 'transfer' ? [[segment.toIndex, segment]] : []),
  )

/** Пунктир переезда — общий для web-карты и WebView native-карты. */
export const ROUTE_TRANSFER_DASH_ARRAY = '2 8'

/**
 * Дуга переезда: квадратичная кривая Безье через точку, отнесённую от середины
 * отрезка на пятую часть его длины влево по ходу. Прямая по карте читалась бы
 * как проложенный путь, а переезд — не дорога. Концы дуги — ровно точки маршрута.
 */
export function transferArc(from: LngLat, to: LngLat, steps = 24): LngLat[] {
  const [x0, y0] = from
  const [x2, y2] = to
  const dx = x2 - x0
  const dy = y2 - y0
  if (dx === 0 && dy === 0) return [from, to]
  const x1 = (x0 + x2) / 2 - dy * 0.2
  const y1 = (y0 + y2) / 2 + dx * 0.2
  const line: LngLat[] = []
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps
    const u = 1 - t
    const lat = u * u * y0 + 2 * u * t * y1 + t * t * y2
    line.push([u * u * x0 + 2 * u * t * x1 + t * t * x2, Math.max(-90, Math.min(90, lat))])
  }
  return line
}

export type RouteLineStyle = 'route' | 'approximate' | 'transfer'

export interface RouteLineSegment {
  style: RouteLineStyle
  /** [lng, lat], как `RouteGeometry`. */
  line: LngLat[]
}

/** Срезы отрезков идут подряд и покрывают геометрию целиком — как её склеил бэкенд. */
const legsCoverGeometry = (legs: readonly RouteLeg[], geometry: RouteGeometry): boolean =>
  legs.length > 0 &&
  legs[legs.length - 1].geometrySlice[1] === geometry.length &&
  legs.every((leg, index) => leg.geometrySlice[0] === (index === 0 ? 0 : legs[index - 1].geometrySlice[1]))

/**
 * Линии карты по отрезкам. `null` — переездов нет, и карты рисуют маршрут одной
 * линией, как до #2056.
 *
 * С отрезками сводки и геометрией, которую они режут (`geometry_slice`), каждый
 * отрезок — свой срез; прогон по прямой (`provider: direct`) приблизителен сам
 * по себе, соседние проложенные прогоны остаются сплошными. Без них (геометрии
 * ещё нет или срезы с ней не сходятся) прогоны рисуются по точкам — это прямые,
 * и они приблизительные. Переезд — всегда дуга между его концами.
 */
export function routeLineSegments(
  route: readonly RoutePoint[],
  geometry: RouteGeometry | null,
  legs: readonly RouteLeg[] | null | undefined,
): RouteLineSegment[] | null {
  if (geometry && legs && legsCoverGeometry(legs, geometry)) {
    if (!legs.some((leg) => leg.mode !== 'route')) return null
    return legs.flatMap((leg): RouteLineSegment[] => {
      const slice = geometry.slice(leg.geometrySlice[0], leg.geometrySlice[1])
      if (slice.length < 2) return []
      if (leg.mode !== 'route') {
        return [{ style: 'transfer', line: transferArc(slice[0], slice[slice.length - 1]) }]
      }
      return [{ style: leg.provider === 'direct' ? 'approximate' : 'route', line: slice }]
    })
  }
  const segments = splitRouteSegments(route)
  if (!hasTransferSegment(segments)) return null
  return segments.flatMap((segment): RouteLineSegment[] => {
    if (segment.kind === 'route') return [{ style: 'approximate', line: segment.points }]
    return segment.line ? [{ style: 'transfer', line: transferArc(segment.line[0], segment.line[1]) }] : []
  })
}
