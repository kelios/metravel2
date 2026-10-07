// Подбор travel-статей под локацию (город/страна/координаты) — для обратной
// перелинковки квест → travel того же города/рядом. Зеркало questForLocation.ts.
import { normalize } from '@/utils/questAdapters'
import { parseTravelCoords } from '@/utils/questForLocation'
import { haversineKm } from '@/utils/geoDistance'
import type { Travel } from '@/types/types'

export type TravelLocationQuery = {
  cityName?: string | null
  countryName?: string | null
  countryCode?: string | null
  /** координаты точек квеста — матчинг travel по близости */
  coords?: Array<{ lat: number; lng: number }>
}

function minPairDistanceKm(
  a: Array<{ lat: number; lng: number }>,
  b: Array<{ lat: number; lng: number }>,
): number {
  if (!a.length || !b.length) return Infinity
  let min = Infinity
  for (const p of a) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue
    for (const q of b) {
      if (!Number.isFinite(q.lat) || !Number.isFinite(q.lng)) continue
      const d = haversineKm(p.lat, p.lng, q.lat, q.lng)
      if (d < min) min = d
    }
  }
  return min
}

/** Координаты точек travel из travelAddress (поддержка string | {coords}). */
export function travelCoords(travel: Travel): Array<{ lat: number; lng: number }> {
  const points = (travel.travelAddress ?? []).map((item) =>
    typeof item === 'string' ? { coord: item } : { coord: (item as { coords?: string })?.coords },
  )
  return parseTravelCoords(points)
}

export type TravelForLocationMatch = {
  travel: Travel
  score: number
  /** Минимальная дистанция между точками travel и точками квеста, км. */
  distanceKm: number
}

/**
 * Возвращает travel-статьи, подходящие под локацию квеста, отсортированные
 * по релевантности и дистанции. Используется для блока «Путешествия по этому
 * городу» на странице квеста.
 */
export function findTravelsNearLocation(
  travels: Travel[],
  query: TravelLocationQuery,
  opts?: { limit?: number },
): TravelForLocationMatch[] {
  if (!Array.isArray(travels) || travels.length === 0) return []

  const qCity = query.cityName ? normalize(query.cityName) : ''
  const qCountry = query.countryName ? normalize(query.countryName) : ''
  const qCode = (query.countryCode || '').toLowerCase().trim()
  const questCoords = query.coords ?? []

  const matches: TravelForLocationMatch[] = []

  for (const travel of travels) {
    const tCity = travel.cityName ? normalize(travel.cityName) : ''
    const tCountry = travel.countryName ? normalize(travel.countryName) : ''
    const tCode = (travel.countryCode || '').toLowerCase().trim()
    const coords = travelCoords(travel)
    const dist = minPairDistanceKm(coords, questCoords)

    if (qCode && tCode && qCode !== tCode) {
      if (!(Number.isFinite(dist) && dist < 15)) continue
    } else if (qCountry && tCountry && qCountry !== tCountry) {
      if (!(Number.isFinite(dist) && dist < 15)) continue
    }

    let score = 0
    if (qCity && tCity) {
      if (qCity === tCity) score += 100
      else if (tCity.includes(qCity) || qCity.includes(tCity)) score += 55
    }

    if (dist < 8) score += 60
    else if (dist < 20) score += 40
    else if (dist < 50) score += 20

    if ((qCountry && tCountry && qCountry === tCountry) || (qCode && tCode && qCode === tCode)) {
      score += 15
    }

    if (score < 55) continue

    matches.push({ travel, score, distanceKm: dist })
  }

  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.distanceKm - b.distanceKm
  })

  const limit = opts?.limit
  if (typeof limit === 'number' && limit > 0 && matches.length > limit) {
    return matches.slice(0, limit)
  }
  return matches
}
