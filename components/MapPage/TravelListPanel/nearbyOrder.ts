import { useMemo, useRef } from 'react'

import { translate as i18nT } from '@/i18n'
import { haversineKm } from '@/utils/geoDistance'
import { CoordinateConverter } from '@/utils/coordinateConverter'

/**
 * #2776 (MAP-NEARBY-CARD-TITLE-HIERARCHY) — порядок и точка отсчёта списка
 * «Места рядом». Бэкенд отдаёт радиус-выдачу страницами по `id`, поэтому первой
 * могла стоять «Парковка у дороги Н8331», а расстояния у карточки не было вовсе:
 * его считали только от GPS, которого у гостя нет.
 *
 * - Точка отсчёта: позиция пользователя, если она известна («от вас»), иначе
 *   центр радиус-запроса («от центра поиска») — тот же, от которого считается
 *   «60 км» в шапке списка.
 * - Порядок: места-цели по расстоянию, служебные точки (парковка, остановка…)
 *   после них. Сортируются загруженные страницы: уже показанные карточки
 *   сохраняют место, новая страница встаёт после них (иначе догрузка при
 *   прокрутке переставляла бы список под пальцем).
 */

export type ListDistanceOriginKind = 'user' | 'searchCenter'

export type ListDistanceOrigin = {
  latitude: number
  longitude: number
  kind: ListDistanceOriginKind
}

type LatLng = { latitude: number; longitude: number } | null | undefined

const isFiniteLatLng = (value: LatLng): value is { latitude: number; longitude: number } =>
  !!value && Number.isFinite(Number(value.latitude)) && Number.isFinite(Number(value.longitude))

export function resolveListDistanceOrigin(
  userLocation: LatLng,
  searchCenter: LatLng,
): ListDistanceOrigin | null {
  if (isFiniteLatLng(userLocation)) {
    return { latitude: Number(userLocation.latitude), longitude: Number(userLocation.longitude), kind: 'user' }
  }
  if (isFiniteLatLng(searchCenter)) {
    return { latitude: Number(searchCenter.latitude), longitude: Number(searchCenter.longitude), kind: 'searchCenter' }
  }
  return null
}

/** «12 км от вас» / «12 км от центра поиска» — фраза целиком одним ключом. */
export function formatDistanceFromOrigin(distanceText: string, kind: ListDistanceOriginKind): string {
  return kind === 'user'
    ? i18nT('map:components.MapPage.TravelListPanel.nearbyOrder.distanceFromYou', { value1: distanceText })
    : i18nT('map:components.MapPage.TravelListPanel.nearbyOrder.distanceFromSearchCenter', { value1: distanceText })
}

/**
 * Служебные категории точек (id справочника `/api/filterformap/`): нужны в
 * дороге, но не цель поездки. Id стабильнее названия — оно локализуется.
 */
export const SERVICE_PLACE_CATEGORY_IDS: ReadonlySet<number> = new Set([
  91, // Парковка
  180, // Остановка
  3, // Аптека
  16, // Больница
  105, // Почта
])

const readCategoryIds = (item: Record<string, unknown>): number[] => {
  const raw = item.categoryIds ?? item.category_ids
  if (!Array.isArray(raw)) return []
  return raw.map((id) => Number(id)).filter((id) => Number.isFinite(id))
}

/** Служебная — только если ВСЕ категории точки служебные («Парковка, Озеро» — цель). */
export function isServicePlace(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false
  const ids = readCategoryIds(item as Record<string, unknown>)
  return ids.length > 0 && ids.every((id) => SERVICE_PLACE_CATEGORY_IDS.has(id))
}

const readItemLatLng = (item: Record<string, unknown>): { lat: number; lng: number } | null => {
  const lat = Number(item.lat)
  const lng = Number(item.lng)
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) return { lat, lng }
  const parsed = typeof item.coord === 'string' ? CoordinateConverter.fromLooseString(item.coord) : null
  return parsed ? { lat: parsed.lat, lng: parsed.lng } : null
}

export function distanceFromOriginKm(item: unknown, origin: ListDistanceOrigin | null): number | null {
  if (!origin || !item || typeof item !== 'object') return null
  const point = readItemLatLng(item as Record<string, unknown>)
  if (!point) return null
  return haversineKm(origin.latitude, origin.longitude, point.lat, point.lng)
}

/** Места-цели по расстоянию, служебные — после; без координат — в конец; ничья — исходный порядок. */
export function sortNearbyPlaces<T>(items: readonly T[], origin: ListDistanceOrigin | null): T[] {
  const ranked = items.map((item, index) => ({
    item,
    index,
    service: isServicePlace(item) ? 1 : 0,
    distance: distanceFromOriginKm(item, origin),
  }))
  ranked.sort((a, b) => {
    if (a.service !== b.service) return a.service - b.service
    const da = a.distance ?? Number.POSITIVE_INFINITY
    const db = b.distance ?? Number.POSITIVE_INFINITY
    if (da !== db) return da - db
    return a.index - b.index
  })
  return ranked.map((entry) => entry.item)
}

/**
 * Сортирует загруженный список, не переставляя уже показанное: если новый
 * набор — продолжение прежнего (догрузка страницы), прежние элементы остаются
 * на своих местах, а новые сортируются между собой и встают в хвост. Новый
 * запрос (другой набор, другой отсчёт) сортируется целиком.
 */
export function orderNearbyPlaces<T>(
  items: readonly T[],
  origin: ListDistanceOrigin | null,
  getKey: (item: T, index: number) => string,
  previous: { keys: readonly string[]; originKey: string } | null,
): { ordered: T[]; keys: string[]; originKey: string } {
  const originKey = origin ? `${origin.kind}:${origin.latitude}:${origin.longitude}` : ''
  const keyed = items.map((item, index) => ({ item, key: getKey(item, index) }))
  const byKey = new Map(keyed.map((entry) => [entry.key, entry.item]))
  const isContinuation =
    !!previous &&
    previous.originKey === originKey &&
    previous.keys.length > 0 &&
    previous.keys.length <= keyed.length &&
    previous.keys.every((key) => byKey.has(key))

  if (!isContinuation) {
    const ordered = sortNearbyPlaces(items, origin)
    const keyOf = new Map(keyed.map((entry) => [entry.item, entry.key]))
    return { ordered, keys: ordered.map((item) => keyOf.get(item) ?? ''), originKey }
  }

  const kept = new Set(previous.keys)
  const head = previous.keys.map((key) => byKey.get(key) as T)
  const tailEntries = keyed.filter((entry) => !kept.has(entry.key))
  const tail = sortNearbyPlaces(tailEntries.map((entry) => entry.item), origin)
  const tailKeyOf = new Map(tailEntries.map((entry) => [entry.item, entry.key]))
  return {
    ordered: [...head, ...tail],
    keys: [...previous.keys, ...tail.map((item) => tailKeyOf.get(item) ?? '')],
    originKey,
  }
}

/** Хук над `orderNearbyPlaces`: помнит показанный порядок между рендерами. */
export function useNearbyPlacesOrder<T>(
  items: readonly T[],
  origin: ListDistanceOrigin | null,
  getKey: (item: T, index: number) => string,
): T[] {
  const previousRef = useRef<{ keys: readonly string[]; originKey: string } | null>(null)
  return useMemo(() => {
    const result = orderNearbyPlaces(items, origin, getKey, previousRef.current)
    previousRef.current = { keys: result.keys, originKey: result.originKey }
    return result.ordered
  }, [items, origin, getKey])
}
