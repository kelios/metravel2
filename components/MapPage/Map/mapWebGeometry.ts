import { CoordinateConverter } from '@/utils/coordinateConverter'
import { isValidCoordinate } from '@/utils/coordinateValidator'

export function getSafeCenter(coordinates?: { latitude?: number; longitude?: number } | null): [number, number] {
  const DEFAULT_LAT = 53.8828449
  const DEFAULT_LNG = 27.7273595

  if (!coordinates) {
    return [DEFAULT_LAT, DEFAULT_LNG]
  }

  const lat = Number(coordinates.latitude)
  const lng = Number(coordinates.longitude)

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return [DEFAULT_LAT, DEFAULT_LNG]
  }

  return [lat, lng]
}

export function getCircleCenter(
  mode: string,
  userLocationLatLng: { lat: number; lng: number } | null,
  safeCenter: [number, number]
): [number, number] | null {
  if (mode === 'radius' && userLocationLatLng) {
    const lat = Number(userLocationLatLng.lat)
    const lng = Number(userLocationLatLng.lng)
    if (isValidCoordinate(lat, lng)) return [lat, lng]
  }

  const lat = Number(safeCenter?.[0])
  const lng = Number(safeCenter?.[1])
  if (!isValidCoordinate(lat, lng)) return null
  return [lat, lng]
}

export function getHintCenterLatLng(
  mode: string,
  circleCenterLatLng: { lat: number; lng: number } | null,
  coordinatesLatLng: { lat: number; lng: number }
) {
  if (mode === 'radius' && circleCenterLatLng) return circleCenterLatLng
  return coordinatesLatLng
}

export function normalizeLngLatWithHint(
  tuple: [number, number],
  hintCenterLatLng: { lat: number; lng: number } | null
): [number, number] {
  const a = tuple?.[0]
  const b = tuple?.[1]
  if (!Number.isFinite(a) || !Number.isFinite(b)) return tuple

  const option1 = { lng: a, lat: b }
  const option2 = { lng: b, lat: a }
  const option1Valid = isValidCoordinate(option1.lat, option1.lng)
  const option2Valid = isValidCoordinate(option2.lat, option2.lng)

  if (option1Valid && !option2Valid) return [option1.lng, option1.lat]
  if (!option1Valid && option2Valid) return [option2.lng, option2.lat]

  if (option1Valid && option2Valid && hintCenterLatLng && isValidCoordinate(hintCenterLatLng.lat, hintCenterLatLng.lng)) {
    try {
      const d1 = CoordinateConverter.distance(hintCenterLatLng, option1 as any)
      const d2 = CoordinateConverter.distance(hintCenterLatLng, option2 as any)
      return d2 < d1 ? [option2.lng, option2.lat] : [option1.lng, option1.lat]
    } catch {
      // noop
    }
  }

  return tuple
}

export function buildRouteLineLatLngObjects(
  mode: string,
  fullRouteCoords: Array<[number, number]> | undefined,
  routePointsForRouting: [number, number][],
  hintCenterLatLng: { lat: number; lng: number } | null
) {
  if (mode !== 'route') return [] as Array<{ lat: number; lng: number }>

  const candidate =
    Array.isArray(fullRouteCoords) && fullRouteCoords.length >= 2 ? fullRouteCoords : routePointsForRouting

  const normalized = (candidate || []).map((p) => normalizeLngLatWithHint(p, hintCenterLatLng))
  const valid = normalized
    .filter(([lng, lat]) => isValidCoordinate(lat, lng))
    .map(([lng, lat]) => ({ lat, lng }))

  return valid.length >= 2 ? valid : ([] as Array<{ lat: number; lng: number }>)
}
