// components/trips/planning/print/tripPlanPrintModel.ts
// #2068: печатная версия плана поездки. Здесь только чистая раскладка данных —
// дни, точки, переезды, длина дня, чеклист; HTML собирает tripPlanPrintHtml,
// а карты и окно печати — printTripPlan. Раскладку держим без React, чтобы её
// целиком проверял jest.
import type { PlannedTrip, RoutePoint, RoutePointArrivalMode } from '@/api/plannedTripsTypes'
import type { TripGearItem } from '@/api/plannedTripsGear'
import { haversineKm } from '@/utils/geo'
import { groupRoutePointsByDay, hikeDayDate, shouldGroupRouteByDay } from '../routePointDays'
import { isDrawableCoordinatePair, isRouteApproximate } from '../tripPlanFormatting'
import { groupGearByCategory, type GearGroup } from '../tripGearRules'

/** [lat, lng] — порядок карты печати (`generateCanvasMapSnapshot`). */
export type PrintLatLng = [number, number]

export interface TripPlanPrintPoint {
  /** Номер точки во всём маршруте, с единицы: тот же, что подпись на карте. */
  number: number
  point: RoutePoint
  latLng: PrintLatLng | null
  /** Переезд к точке от предыдущей: способ и расстояние по прямой. */
  arrival: { mode: RoutePointArrivalMode; distanceKm: number | null } | null
}

export interface TripPlanPrintDay {
  key: string
  /** null — группа точек без дня (или весь маршрут, если дней в плане нет). */
  dayNumber: number | null
  /** `YYYY-MM-DD`: старт поездки + (день − 1). */
  date: string | null
  points: TripPlanPrintPoint[]
  /** Длина по линии маршрута без переездов; null — считать не из чего. */
  distanceKm: number | null
  /**
   * Карта дня: самый длинный прогон без переездов. Прогон, начатый утренним
   * путём, открывается точкой прошлого дня — этот путь уже входит в длину дня.
   * null — карты у дня нет.
   */
  map: { line: PrintLatLng[]; points: TripPlanPrintPoint[] } | null
  overnight: TripPlanPrintPoint | null
}

export interface TripPlanPrintModel {
  trip: PlannedTrip
  days: TripPlanPrintDay[]
  hasDays: boolean
  overnights: TripPlanPrintPoint[]
  transferDistanceKm: number
  /**
   * Расстояния — оценка по прямой: прокладка не удалась или линии нет вовсе
   * (поездку не прокладывали, превью ещё считается).
   */
  approximate: boolean
  gear: GearGroup[]
}

const toLatLng = (point: RoutePoint): PrintLatLng | null => {
  const pair = point.coordinates
  if (!pair || !isDrawableCoordinatePair(pair)) return null
  return [pair[1], pair[0]]
}

// Без округления: `calculateDistance` округляет отрезок до 0,1 км, а у плотной
// линии тропы отрезки по несколько метров — сумма ушла бы в ноль.
const distanceKm = (from: PrintLatLng, to: PrintLatLng): number =>
  haversineKm(from[0], from[1], to[0], to[1])

const lineLengthKm = (line: PrintLatLng[]): number => {
  let total = 0
  for (let i = 1; i < line.length; i += 1) total += distanceKm(line[i - 1], line[i])
  return total
}

/**
 * Запас над ближайшим расстоянием, в котором вершина линии считается
 * прохождением точки, км. Маршрутизатор проводит линию через одну и ту же
 * вершину при каждом прохождении точки, поэтому запас нужен узкий: широкий
 * (200 м) склеивал точки одного квартала, и вечерняя прогулка по городу
 * получала 0,1 км вместо 0,8.
 */
const ANCHOR_TOLERANCE_KM = 0.03

/**
 * Вершина сохранённой линии для каждой точки. Поиск идёт только вперёд от
 * предыдущей точки и берёт ПЕРВОЕ прохождение рядом с точкой, а не самую
 * близкую вершину всей оставшейся линии: кольцевые петли проходят мимо одного
 * места дважды (у Mullerthal Trail — Эхтернах в начале и в конце), и глобальный
 * минимум привязал бы точку середины поездки к финишу.
 */
const anchorPointsToGeometry = (points: Array<PrintLatLng | null>, geometry: PrintLatLng[]): Array<number | null> => {
  const anchors: Array<number | null> = []
  let from = 0
  for (const latLng of points) {
    if (!latLng) {
      anchors.push(null)
      continue
    }
    const distances: number[] = []
    let nearest = Infinity
    for (let i = from; i < geometry.length; i += 1) {
      const d = distanceKm(geometry[i], latLng)
      distances.push(d)
      if (d < nearest) nearest = d
    }
    const limit = nearest * 1.5 + ANCHOR_TOLERANCE_KM
    // Вершина предыдущей точки — последний кандидат: финиш кольца в той же
    // точке, что и старт петли, иначе «слипся» бы с ним, и петля потерялась.
    const skipFrom = anchors.some((value) => value != null) ? 1 : 0
    const firstNear = distances.findIndex((d, i) => i >= skipFrom && d <= limit)
    const anchor = from + Math.max(0, firstNear)
    anchors.push(anchor)
    from = anchor
  }
  return anchors
}

interface Edge {
  /** Индексы точек маршрута: откуда (предыдущая с координатами) и куда. */
  from: number
  to: number
  line: PrintLatLng[]
  transfer: boolean
}

/**
 * Рёбра маршрута «точка k−1 → точка k». Ребро принадлежит дню своей точки
 * назначения: утренний путь от ночёвки к автобусу — часть следующего дня.
 * Ребро к точке с `arrivalMode` — переезд, в длину дня и карту не входит.
 * Переезд к точке без координат переходит на ребро до следующей точки с
 * координатами: бэкенд этот участок тоже не прокладывает (#2055).
 */
const buildEdges = (route: RoutePoint[], latLngs: Array<PrintLatLng | null>, geometry: PrintLatLng[] | null): Edge[] => {
  const anchors = geometry ? anchorPointsToGeometry(latLngs, geometry) : null
  const edges: Edge[] = []
  let prev: number | null = null
  let transferPending = false
  route.forEach((point, index) => {
    if (point.arrivalMode != null) transferPending = true
    const here = latLngs[index]
    if (!here) return
    if (prev != null) {
      const transfer = transferPending
      const a = anchors?.[prev]
      const b = anchors?.[index]
      const line =
        !transfer && geometry && a != null && b != null && b > a
          ? geometry.slice(a, b + 1)
          : [latLngs[prev] as PrintLatLng, here]
      edges.push({ from: prev, to: index, line, transfer })
    }
    prev = index
    transferPending = false
  })
  return edges
}

interface MapRun {
  line: PrintLatLng[]
  points: TripPlanPrintPoint[]
  length: number
  /** Индекс последней точки прогона в маршруте. */
  last: number
}

const pickMapRun = (dayIndices: number[], edgesByTo: Map<number, Edge>, printPoints: TripPlanPrintPoint[]) => {
  // Прогон — непрерывная цепочка рёбер без переездов. Ребро, пришедшее в день
  // снаружи (утренний путь от ночёвки), открывает прогон своей исходной точкой:
  // длина дня его уже считает, и карта без него начиналась бы не у ночёвки.
  // Ребро продолжает прогон, только выходя из его последней точки, — иначе
  // линия прыгнула бы через точки другого дня.
  const runs: MapRun[] = []
  let current: MapRun | null = null
  for (const index of dayIndices) {
    const printPoint = printPoints[index]
    if (!printPoint.latLng) continue
    const edge = edgesByTo.get(index)
    const walked = edge && !edge.transfer ? edge : null
    if (current && walked && walked.from === current.last) {
      current.line.push(...walked.line.slice(1))
      current.points.push(printPoint)
      current.length += lineLengthKm(walked.line)
      current.last = index
      continue
    }
    // Утро у той же ночёвки (ребро короче запаса привязки) метки прошлого дня не
    // требует: она легла бы под первую точку дня.
    const seed = walked && lineLengthKm(walked.line) > ANCHOR_TOLERANCE_KM ? walked : null
    current = seed
      ? { line: [...seed.line], points: [printPoints[seed.from], printPoint], length: lineLengthKm(seed.line), last: index }
      : { line: [printPoint.latLng], points: [printPoint], length: 0, last: index }
    runs.push(current)
  }
  const best = runs
    .filter((run) => run.points.length >= 2)
    .sort((a, b) => b.length - a.length || b.points.length - a.points.length)[0]
  return best ? { line: best.line, points: best.points } : null
}

export function buildTripPlanPrintModel(trip: PlannedTrip, gearItems: TripGearItem[] | null): TripPlanPrintModel {
  const route = trip.route
  const latLngs = route.map(toLatLng)
  const geometry =
    trip.routeGeometry && trip.routeGeometry.length >= 2
      ? trip.routeGeometry.map(([lng, lat]) => [lat, lng] as PrintLatLng)
      : null
  const edges = buildEdges(route, latLngs, geometry)
  const edgesByTo = new Map(edges.map((edge) => [edge.to, edge]))

  const printPoints: TripPlanPrintPoint[] = route.map((point, index) => {
    const edge = edgesByTo.get(index)
    return {
      number: index + 1,
      point,
      latLng: latLngs[index],
      arrival:
        index > 0 && point.arrivalMode
          ? { mode: point.arrivalMode, distanceKm: edge ? lineLengthKm(edge.line) : null }
          : null,
    }
  })

  // Дни — по тем же правилам, что список точек конструктора (#1845): лист «День 4»
  // на бумаге обязан совпадать с заголовком дня на экране.
  const hasDays = shouldGroupRouteByDay(route)
  const groups = groupRoutePointsByDay(route)

  const days: TripPlanPrintDay[] = groups.map(({ dayNumber, indices }) => {
    const dayEdges = indices.map((index) => edgesByTo.get(index)).filter((edge): edge is Edge => Boolean(edge))
    const walked = dayEdges.filter((edge) => !edge.transfer)
    const points = indices.map((index) => printPoints[index])
    const overnights = points.filter((p) => p.point.type === 'overnight')
    return {
      key: dayNumber != null ? `day-${dayNumber}` : 'no-day',
      dayNumber,
      date: dayNumber != null ? hikeDayDate(trip.startDate, dayNumber) : null,
      points,
      distanceKm: walked.length ? walked.reduce((sum, edge) => sum + lineLengthKm(edge.line), 0) : null,
      map: pickMapRun(indices, edgesByTo, printPoints),
      overnight: overnights.length ? overnights[overnights.length - 1] : null,
    }
  })

  return {
    trip,
    days,
    hasDays,
    overnights: printPoints.filter((p) => p.point.type === 'overnight'),
    transferDistanceKm: edges.filter((edge) => edge.transfer).reduce((sum, edge) => sum + lineLengthKm(edge.line), 0),
    approximate: isRouteApproximate(trip.routingState) || (!geometry && edges.some((edge) => !edge.transfer)),
    gear: gearItems ? groupGearByCategory(gearItems) : [],
  }
}
