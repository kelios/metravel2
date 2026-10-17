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
  /**
   * #2452 — запрос тайла у моста RN. `fallback: true` — сетевая загрузка тайла
   * в WebView провалилась (онлайн-режим); без флага — слой в офлайн-режиме.
   */
  | { type: 'TILE_REQ'; z: number; x: number; y: number; key: string; fallback?: true }
  /** #2452 — тайлы сняты с карты до ответа моста: их ответы больше не нужны. */
  | { type: 'TILE_CANCEL'; keys: string[] }
  /** #2452 — счётчики подложки после догрузки вьюпорта (замер, dev-лог). */
  | { type: 'MAP_TILES_STATE'; state: NativeTileStateSnapshot }
  /**
   * #2452 — тайлы, снятые WebView из уже загруженных картинок: пакет ≤8 пар
   * `[z/x/y, dataUrl]` для дискового кэша (валидируются при записи).
   */
  | { type: 'TILE_CAPTURE'; gen: number | null; tiles: unknown[] }
  /** #2452 — canvas «грязный» (нет CORS): захват выключен до перезапуска. */
  | { type: 'TILE_CAPTURE_DISABLED'; reason: string }
  | { type: 'MAP_CLICK'; latitude: number; longitude: number }
  /** Legacy-форма (HTML до #2453): отдельное сообщение центра после жеста. */
  | {
      type: 'MAP_MOVED'
      move: MapMovePayload | null
      viewport: NativeViewportSnapshot | null
    }
  /**
   * #2453 — единственное сообщение вьюпорта: не чаще раза в 300 мс после
   * `moveend`/`zoomend` (плюс одно стартовое). `move` заполнен, только если
   * центр реально сдвинулся (jitter-гард F-49), `byUser` — жест пользователя.
   */
  | {
      type: 'MAP_VIEWPORT'
      viewport: NativeViewportSnapshot | null
      move: MapMovePayload | null
      byUser: boolean
    }
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

export interface NativeTileStateSnapshot {
  /** Тайлы, отрисованные из моста (диск RN). */
  loaded: number
  /** Тайлы, загруженные WebView напрямую по сети. */
  netLoaded: number
  /** Сетевые ошибки тайлов в WebView (каждая — один запрос fallback). */
  netErrors: number
  /** Провалы моста: тайла нет ни в сети, ни на диске. */
  errors: number
  /** Запросы, ещё ждущие ответа моста. */
  pending: number
  /** Запросы fallback, отправленные в мост. */
  fallbacks: number
  /** Ответы моста на уже снятые тайлы. */
  dropped: number
  online: boolean
  /** Время от начала загрузки вьюпорта до события `load` слоя, мс. */
  ms: number | null
  /** Догруженный вьюпорт — по нему RN планирует захват тайлов в кэш. */
  viewport: NativeViewportSnapshot | null
}

const toCount = (value: unknown): number => {
  const numberValue = toFiniteNumber(value)
  return numberValue != null && numberValue >= 0 ? numberValue : 0
}

const parseTileState = (parsed: Record<string, unknown>): NativeTileStateSnapshot => ({
  loaded: toCount(parsed.loaded),
  netLoaded: toCount(parsed.netLoaded),
  netErrors: toCount(parsed.netErrors),
  errors: toCount(parsed.failed),
  pending: toCount(parsed.pending),
  fallbacks: toCount(parsed.fallbacks),
  dropped: toCount(parsed.dropped),
  online: parsed.online === true,
  ms: toFiniteNumber(parsed.ms),
  viewport: parseViewport(parsed),
})

export const normalizeRoutePoint = (point: unknown): [number, number] | null => {
  if (!Array.isArray(point) || point.length < 2) return null
  const coordinate = toFiniteCoordinate(point[1], point[0])
  return coordinate ? [coordinate.latitude, coordinate.longitude] : null
}

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
      return parsed.fallback === true
        ? { type: 'TILE_REQ', z, x, y, key, fallback: true }
        : { type: 'TILE_REQ', z, x, y, key }
    }
    case 'TILE_CANCEL': {
      const keys = Array.isArray(parsed.keys)
        ? parsed.keys.filter((key): key is string => typeof key === 'string')
        : []
      return keys.length ? { type: 'TILE_CANCEL', keys } : null
    }
    case 'MAP_TILES_STATE':
      return { type: 'MAP_TILES_STATE', state: parseTileState(parsed) }
    case 'TILE_CAPTURE':
      return Array.isArray(parsed.tiles) && parsed.tiles.length
        ? { type: 'TILE_CAPTURE', gen: toFiniteNumber(parsed.gen), tiles: parsed.tiles.slice(0, 8) }
        : null
    case 'TILE_CAPTURE_DISABLED':
      return { type: 'TILE_CAPTURE_DISABLED', reason: typeof parsed.reason === 'string' ? parsed.reason : '' }
    case 'MAP_CLICK': {
      const coordinate = toFiniteCoordinate(parsed.lat, parsed.lng)
      return coordinate ? { type: 'MAP_CLICK', ...coordinate } : null
    }
    case 'MAP_MOVED':
      return { type: 'MAP_MOVED', move: parseMapMove(parsed), viewport: parseViewport(parsed) }
    case 'MAP_VIEWPORT': {
      const byUser = parsed.byUser === true
      const move = parsed.centerMoved === true
        ? parseMapMove({ ...parsed, userInitiated: byUser })
        : null
      return { type: 'MAP_VIEWPORT', viewport: parseViewport(parsed), move, byUser }
    }
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
