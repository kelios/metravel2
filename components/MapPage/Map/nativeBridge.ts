import type { MapClusterBBox } from '@/api/map'
import type { MapMovePayload } from '@/components/MapPage/Map/types'
import {
  isUnknownRecord,
  parseWebViewJsonObject,
  toFiniteCoordinate,
  toFiniteNumber,
} from '@/utils/webViewBridge'

export interface NativeViewportSnapshot {
  bbox: MapClusterBBox
  zoom: number
}

export type NativeMapBridgeMessage =
  | { type: 'READY' }
  | { type: 'TILE_REQ'; z: number; x: number; y: number; key: string }
  | { type: 'MAP_CLICK'; latitude: number; longitude: number }
  | {
      type: 'MAP_MOVED'
      move: MapMovePayload | null
      viewport: NativeViewportSnapshot | null
    }
  | { type: 'MAP_VIEWPORT'; viewport: NativeViewportSnapshot | null }
  /**
   * Тап по маркеру места. `placeKey` — стабильный ключ физического места (#1573),
   * по нему RN находит выбранное место независимо от порядка и обновлений
   * dataset. `index`/`id`/`coord` остаются legacy-fallback на переходный период,
   * пока в проде могут жить обе версии WebView-HTML.
   */
  | { type: 'SELECT_PLACE'; placeKey: string; index: number | null; id: string; coord: string }
  /**
   * #1781: маркер точки маршрута планировщика отпущен в новом месте. `index` —
   * позиция точки в переданном списке `routePoints`, порядок при этом не меняется.
   */
  | { type: 'ROUTE_POINT_MOVED'; index: number; latitude: number; longitude: number }
  /** #1781: тап по маркеру точки маршрута — запрос действий над этой точкой. */
  | { type: 'ROUTE_POINT_TAP'; index: number }
  | { type: 'OPEN_URL'; url: string }

export const normalizeRoutePoint = (point: unknown): [number, number] | null => {
  if (!Array.isArray(point) || point.length < 2) return null
  const coordinate = toFiniteCoordinate(point[1], point[0])
  return coordinate ? [coordinate.latitude, coordinate.longitude] : null
}

export const isSameViewportSnapshot = (
  left: NativeViewportSnapshot | null,
  right: NativeViewportSnapshot,
): boolean =>
  Boolean(
    left &&
      Math.abs(left.zoom - right.zoom) < 0.01 &&
      Math.abs(left.bbox.south - right.bbox.south) < 0.0005 &&
      Math.abs(left.bbox.west - right.bbox.west) < 0.0005 &&
      Math.abs(left.bbox.north - right.bbox.north) < 0.0005 &&
      Math.abs(left.bbox.east - right.bbox.east) < 0.0005,
  )

const parseViewport = (parsed: Record<string, unknown>): NativeViewportSnapshot | null => {
  const zoom = toFiniteNumber(parsed.zoom)
  const rawBbox = parsed.bbox
  if (zoom == null || !isUnknownRecord(rawBbox)) return null
  const south = toFiniteNumber(rawBbox.south)
  const west = toFiniteNumber(rawBbox.west)
  const north = toFiniteNumber(rawBbox.north)
  const east = toFiniteNumber(rawBbox.east)
  if (south == null || west == null || north == null || east == null) return null
  return { bbox: { south, west, north, east }, zoom }
}

const parseMapMove = (parsed: Record<string, unknown>): MapMovePayload | null => {
  const coordinate = toFiniteCoordinate(parsed.lat, parsed.lng)
  if (!coordinate) return null
  const payload: MapMovePayload = coordinate
  const zoom = toFiniteNumber(parsed.zoom)
  if (zoom != null) payload.zoom = zoom
  if (parsed.userInitiated === true) payload.userInitiated = true
  const viewport = parseViewport(parsed)
  if (viewport) payload.bbox = viewport.bbox
  return payload
}

/** Индекс точки маршрута: только целое неотрицательное значение. */
const parseRoutePointIndex = (value: unknown): number | null => {
  const index = toFiniteNumber(value)
  return index != null && Number.isInteger(index) && index >= 0 ? index : null
}

export const parseNativeMapBridgeMessage = (raw: unknown): NativeMapBridgeMessage | null => {
  const parsed = parseWebViewJsonObject(raw)
  if (!parsed || typeof parsed.type !== 'string') return null

  switch (parsed.type) {
    case 'READY':
      return { type: 'READY' }
    case 'TILE_REQ': {
      const z = toFiniteNumber(parsed.z)
      const x = toFiniteNumber(parsed.x)
      const y = toFiniteNumber(parsed.y)
      if (z == null || x == null || y == null) return null
      const key = typeof parsed.key === 'string' ? parsed.key : `${z}/${x}/${y}`
      return { type: 'TILE_REQ', z, x, y, key }
    }
    case 'MAP_CLICK': {
      const coordinate = toFiniteCoordinate(parsed.lat, parsed.lng)
      return coordinate ? { type: 'MAP_CLICK', ...coordinate } : null
    }
    case 'MAP_MOVED':
      return { type: 'MAP_MOVED', move: parseMapMove(parsed), viewport: parseViewport(parsed) }
    case 'MAP_VIEWPORT':
      return { type: 'MAP_VIEWPORT', viewport: parseViewport(parsed) }
    case 'SELECT_PLACE': {
      const indexValue = toFiniteNumber(parsed.index)
      const index = indexValue != null && Number.isInteger(indexValue) ? indexValue : null
      const id =
        typeof parsed.id === 'string' || typeof parsed.id === 'number' ? String(parsed.id) : ''
      const coord = typeof parsed.coord === 'string' ? parsed.coord.trim() : ''
      const placeKey =
        typeof parsed.placeKey === 'string' || typeof parsed.placeKey === 'number'
          ? String(parsed.placeKey).trim()
          : ''
      if (!placeKey && index == null && !id && !coord) return null
      return { type: 'SELECT_PLACE', placeKey, index, id, coord }
    }
    case 'ROUTE_POINT_MOVED': {
      const index = parseRoutePointIndex(parsed.index)
      if (index == null) return null
      const coordinate = toFiniteCoordinate(parsed.lat, parsed.lng)
      return coordinate ? { type: 'ROUTE_POINT_MOVED', index, ...coordinate } : null
    }
    case 'ROUTE_POINT_TAP': {
      const index = parseRoutePointIndex(parsed.index)
      return index == null ? null : { type: 'ROUTE_POINT_TAP', index }
    }
    case 'OPEN_URL':
      return typeof parsed.url === 'string' ? { type: 'OPEN_URL', url: parsed.url } : null
    default:
      return null
  }
}
