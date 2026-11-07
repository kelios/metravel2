/**
 * POST /ai/near-route (#2911): материалы сайта в коридоре маршрута планировщика.
 *
 *   {points: [{lat, lng}], limit?: 1..NEAR_ROUTE_MAX_LIMIT, locale?} → {items, took_ms}
 *
 * Чистая геометрия по индексу в памяти — без модели и без эмбеддинга, как у
 * `/ai/similar`: у каждого источника индекса (`rowsBySource`) берётся фрагмент
 * запрошенной локали (квест) или первый, его `lat/lng` сравнивается с маршрутом —
 * расстояние до ближайшего сегмента ломаной (при одной точке — до неё), haversine по
 * ближайшей точке сегмента. Источники ближе `NEAR_ROUTE_CORRIDOR_KM` идут в выдачу по
 * возрастанию расстояния; дедуп по источнику даёт сам обход `rowsBySource`.
 * `items[]` — форма `/ai/search` (`itemForRow`, `score: null` — косинуса здесь нет)
 * плюс `distance_km`. 400 — нет точек, кривая точка или больше `NEAR_ROUTE_MAX_POINTS`.
 */
import type { ChunkRecord } from '../ai-index/format.ts'
import { haversineKm } from '../../utils/geoDistance.ts'
import type { LoadedIndex } from './index.ts'
import { HttpError } from './params.ts'
import { itemForRow, type Locale, type ResultItem } from './search.ts'

export const NEAR_ROUTE_CORRIDOR_KM = 30
export const NEAR_ROUTE_MAX_POINTS = 50
export const NEAR_ROUTE_MAX_LIMIT = 12
export const NEAR_ROUTE_DEFAULT_LIMIT = 8

export interface GeoPoint {
  lat: number
  lng: number
}

export interface NearRouteItem extends ResultItem {
  /** Расстояние от источника до маршрута, км, с сотыми. */
  distance_km: number
}

export interface NearRouteQuery {
  points: GeoPoint[]
  locale: Locale
  limit: number
  corridorKm?: number
}

const isLat = (value: number) => Number.isFinite(value) && value >= -90 && value <= 90
const isLng = (value: number) => Number.isFinite(value) && value >= -180 && value <= 180

export function parseNearRoutePoints(value: unknown): GeoPoint[] {
  if (!Array.isArray(value) || value.length === 0) throw new HttpError(400, 'bad_request', 'points: непустой массив {lat, lng}')
  if (value.length > NEAR_ROUTE_MAX_POINTS) throw new HttpError(400, 'bad_request', `points: не больше ${NEAR_ROUTE_MAX_POINTS} точек`)
  return value.map((raw, index) => {
    const point = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const lat = typeof point.lat === 'number' ? point.lat : Number(point.lat)
    const lng = typeof point.lng === 'number' ? point.lng : Number(point.lng)
    if (!isLat(lat) || !isLng(lng)) throw new HttpError(400, 'bad_request', `points[${index}]: lat в [-90, 90], lng в [-180, 180]`)
    return { lat, lng }
  })
}

export function parseNearRouteLimit(value: unknown): number {
  if (value === undefined || value === null || value === '') return NEAR_ROUTE_DEFAULT_LIMIT
  const limit = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(limit) || limit < 1 || limit > NEAR_ROUTE_MAX_LIMIT) {
    throw new HttpError(400, 'bad_request', `limit: целое от 1 до ${NEAR_ROUTE_MAX_LIMIT}`)
  }
  return limit
}

const toRad = (deg: number) => (deg * Math.PI) / 180

/**
 * Расстояние от точки до ломаной маршрута, км. Ближайшая точка сегмента ищется в
 * локальной равноугольной проекции (долгота сжата на cos широты — на сотнях км
 * ошибка в сотые доли), а само расстояние считается haversine до неё.
 */
export function distanceToRouteKm(point: GeoPoint, route: GeoPoint[]): number {
  let best = Number.POSITIVE_INFINITY
  if (route.length === 1) return haversineKm(point.lat, point.lng, route[0].lat, route[0].lng)
  for (let i = 0; i + 1 < route.length; i += 1) {
    const a = route[i]
    const b = route[i + 1]
    const scale = Math.cos(toRad((a.lat + b.lat + point.lat) / 3))
    const ax = a.lng * scale
    const bx = b.lng * scale
    const px = point.lng * scale
    const dx = bx - ax
    const dy = b.lat - a.lat
    const lengthSq = dx * dx + dy * dy
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (point.lat - a.lat) * dy) / lengthSq))
    const nearestLat = a.lat + t * dy
    const nearestLng = (ax + t * dx) / scale
    const distance = haversineKm(point.lat, point.lng, nearestLat, nearestLng)
    if (distance < best) best = distance
  }
  return best
}

/** Источники индекса с координатами в коридоре маршрута, ближние первыми, не больше `limit`. */
export function nearRouteItems(index: LoadedIndex, query: NearRouteQuery): NearRouteItem[] {
  const corridor = query.corridorKm ?? NEAR_ROUTE_CORRIDOR_KM
  const { chunks } = index.artifact
  const found: Array<{ row: number; distance: number }> = []
  for (const rows of index.rowsBySource.values()) {
    const row = rows.find((candidate) => chunks[candidate].locale === query.locale) ?? rows[0]
    const chunk: ChunkRecord = chunks[row]
    if (chunk.lat === null || chunk.lng === null || !isLat(chunk.lat) || !isLng(chunk.lng)) continue
    const distance = distanceToRouteKm({ lat: chunk.lat, lng: chunk.lng }, query.points)
    if (distance <= corridor) found.push({ row, distance })
  }
  found.sort((a, b) => a.distance - b.distance || a.row - b.row)
  return found.slice(0, query.limit).map(({ row, distance }) => ({
    ...itemForRow(index, row, null),
    distance_km: Math.round(distance * 100) / 100,
  }))
}
