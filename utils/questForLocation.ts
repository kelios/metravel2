// Подбор квеста под локацию (город/страна/координаты) — для перелинковки
// travel-страница ↔ квест по тому же городу.
import { normalize } from '@/utils/questAdapters'
import type { QuestMeta } from '@/utils/questAdapters'

export type LocationQuery = {
  cityName?: string | null
  countryName?: string | null
  countryCode?: string | null
  /** координаты любых точек локации (для матчинга по близости) */
  coords?: Array<{ lat: number; lng: number }>
}

const EARTH_R = 6371 // км

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function minDistanceKm(coords: LocationQuery['coords'], lat: number, lng: number): number {
  if (!coords || !coords.length || !Number.isFinite(lat) || !Number.isFinite(lng)) return Infinity
  let min = Infinity
  for (const c of coords) {
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) continue
    const d = haversineKm(c.lat, c.lng, lat, lng)
    if (d < min) min = d
  }
  return min
}

/**
 * Возвращает наиболее подходящий квест для локации или null.
 * Логика: совпадение города (точное/вхождение) или близость (<40 км),
 * при этом разные страны (если обе известны) дисквалифицируют матч.
 */
export function findQuestForLocation(
  quests: QuestMeta[],
  query: LocationQuery,
): QuestMeta | null {
  if (!Array.isArray(quests) || quests.length === 0) return null

  const qCity = query.cityName ? normalize(query.cityName) : ''
  const qCountry = query.countryName ? normalize(query.countryName) : ''
  const qCode = (query.countryCode || '').toLowerCase().trim()

  let best: { quest: QuestMeta; score: number; dist: number } | null = null

  for (const quest of quests) {
    const cCity = quest.cityName ? normalize(quest.cityName) : ''
    const cCountry = quest.countryName ? normalize(quest.countryName) : ''
    const cCode = (quest.countryCode || '').toLowerCase().trim()

    // Дисквалификация при явном конфликте стран
    if (qCode && cCode && qCode !== cCode) continue
    if (!qCode || !cCode) {
      if (qCountry && cCountry && qCountry !== cCountry) {
        // страны заданы именами и не совпадают — пропускаем,
        // но только если нет очень близкой геопривязки (см. ниже)
        const near = minDistanceKm(query.coords, quest.lat, quest.lng) < 15
        if (!near) continue
      }
    }

    let score = 0
    if (qCity && cCity) {
      if (qCity === cCity) score += 100
      else if (cCity.includes(qCity) || qCity.includes(cCity)) score += 55
    }

    const dist = minDistanceKm(query.coords, quest.lat, quest.lng)
    if (dist < 8) score += 60
    else if (dist < 20) score += 40
    else if (dist < 50) score += 20

    if ((qCountry && cCountry && qCountry === cCountry) || (qCode && cCode && qCode === cCode)) {
      score += 15
    }

    if (score < 55) continue // порог: нужен либо город, либо близость

    if (!best || score > best.score || (score === best.score && dist < best.dist)) {
      best = { quest, score, dist }
    }
  }

  return best ? best.quest : null
}

export type QuestForLocationMatch = {
  quest: QuestMeta
  score: number
  /** Минимальное расстояние от точек travel до квеста в км; Infinity, если координат нет. */
  distanceKm: number
}

/**
 * Возвращает все квесты, подходящие под локацию (по тем же правилам, что и
 * findQuestForLocation), отсортированные по убыванию score, затем по дистанции.
 * Используется для блока «Квесты по этому городу и рядом» на travel-странице.
 */
export function findQuestsNearLocation(
  quests: QuestMeta[],
  query: LocationQuery,
  opts?: { limit?: number },
): QuestForLocationMatch[] {
  if (!Array.isArray(quests) || quests.length === 0) return []

  const qCity = query.cityName ? normalize(query.cityName) : ''
  const qCountry = query.countryName ? normalize(query.countryName) : ''
  const qCode = (query.countryCode || '').toLowerCase().trim()

  const matches: QuestForLocationMatch[] = []

  for (const quest of quests) {
    const cCity = quest.cityName ? normalize(quest.cityName) : ''
    const cCountry = quest.countryName ? normalize(quest.countryName) : ''
    const cCode = (quest.countryCode || '').toLowerCase().trim()

    if (qCode && cCode && qCode !== cCode) continue
    if (!qCode || !cCode) {
      if (qCountry && cCountry && qCountry !== cCountry) {
        const near = minDistanceKm(query.coords, quest.lat, quest.lng) < 15
        if (!near) continue
      }
    }

    let score = 0
    if (qCity && cCity) {
      if (qCity === cCity) score += 100
      else if (cCity.includes(qCity) || qCity.includes(cCity)) score += 55
    }

    const dist = minDistanceKm(query.coords, quest.lat, quest.lng)
    if (dist < 8) score += 60
    else if (dist < 20) score += 40
    else if (dist < 50) score += 20

    if ((qCountry && cCountry && qCountry === cCountry) || (qCode && cCode && qCode === cCode)) {
      score += 15
    }

    if (score < 55) continue

    matches.push({ quest, score, distanceKm: dist })
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

/** Парсит координаты точек travel (coord: "lat,lng") в массив {lat,lng}. */
export function parseTravelCoords(
  points: Array<{ coord?: string | null } | null | undefined> | undefined | null,
): Array<{ lat: number; lng: number }> {
  if (!Array.isArray(points)) return []
  const out: Array<{ lat: number; lng: number }> = []
  for (const p of points) {
    const raw = p?.coord
    if (!raw || typeof raw !== 'string') continue
    const [latS, lngS] = raw.split(',').map((s) => s.trim())
    const lat = Number(latS)
    const lng = Number(lngS)
    if (Number.isFinite(lat) && Number.isFinite(lng)) out.push({ lat, lng })
  }
  return out
}
