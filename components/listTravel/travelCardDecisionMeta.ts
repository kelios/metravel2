import { translate as i18nT } from '@/i18n'
import { DEFAULT_MAP_CENTER } from '@/constants/mapConfig'
import { calculateDistance, formatDistance } from '@/utils/distanceCalculator'
import { formatDays } from '@/utils/pluralize'

/**
 * Мета, по которой на карточке решают «поеду ли».
 * Список отдаёт длительность и одну опорную точку (#2783). Длина маршрута и
 * транспорт в этом ответе не приходят. Расстояние считается до опорной точки:
 * от уже известной позиции пользователя, иначе от Минска. Геолокацию карточка
 * сама не запрашивает.
 */
export type CardDistanceOrigin = {
  lat: number
  lng: number
  kind: 'user' | 'minsk'
}

export const MINSK_CARD_DISTANCE_ORIGIN: CardDistanceOrigin = {
  lat: DEFAULT_MAP_CENTER.latitude,
  lng: DEFAULT_MAP_CENTER.longitude,
  kind: 'minsk',
}

export type TravelCardDecisionMeta = {
  duration: string | null
  distance: string | null
  line: string | null
}

const isFiniteCoord = (lat: number, lng: number): boolean =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180

export function readTravelCardAnchor(source: {
  lat?: unknown
  lng?: unknown
}): { lat: number; lng: number } | null {
  if (source.lat == null || source.lng == null || source.lat === '' || source.lng === '') return null
  const lat = typeof source.lat === 'number' ? source.lat : Number(source.lat)
  const lng = typeof source.lng === 'number' ? source.lng : Number(source.lng)
  if (!isFiniteCoord(lat, lng)) return null
  return { lat, lng }
}

export function readTravelCardDuration(numberDays: unknown): string | null {
  const days = typeof numberDays === 'number' ? numberDays : Number(numberDays)
  if (!Number.isFinite(days) || days <= 0) return null
  return formatDays(Math.round(days)) || null
}

export function formatTravelCardDistance(
  anchor: { lat: number; lng: number },
  origin: CardDistanceOrigin,
): string | null {
  const km = calculateDistance(anchor, { lat: origin.lat, lng: origin.lng })
  if (!Number.isFinite(km) || km <= 0) return null
  const formatted = formatDistance(km)
  return origin.kind === 'user'
    ? i18nT('map:components.MapPage.TravelListPanel.nearbyOrder.distanceFromYou', { value1: formatted })
    : i18nT('travel:components.listTravel.travelCardDecisionMeta.distanceFromMinsk', { value1: formatted })
}

export function buildTravelCardDecisionMeta(input: {
  numberDays?: unknown
  lat?: unknown
  lng?: unknown
  origin?: CardDistanceOrigin
}): TravelCardDecisionMeta {
  const duration = readTravelCardDuration(input.numberDays)
  const anchor = readTravelCardAnchor(input)
  const distance = anchor
    ? formatTravelCardDistance(anchor, input.origin ?? MINSK_CARD_DISTANCE_ORIGIN)
    : null
  const line = [duration, distance].filter(Boolean).join(' · ') || null
  return { duration, distance, line }
}
