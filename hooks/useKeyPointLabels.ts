import { useCallback, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import type { ParsedRoutePreview } from '@/types/travelRoutes'
import { reverseGeocodePoint, type ReverseGeocodePointResult } from '@/api/geoQueries'
import { overpassQuery } from '@/api/external/overpass'
import { buildGeocodeParts, pickDisplayNameSegment } from '@/utils/geocodeHelpers'

interface KeyPointLabels {
  startName?: string | null
  peakName?: string | null
  finishName?: string | null
}

const parseCoord = (coord: string): { lat: number; lng: number } | null => {
  const [latStr, lngStr] = String(coord ?? '').replace(/;/g, ',').split(',')
  const lat = Number(latStr)
  const lng = Number(lngStr)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

/**
 * Подпись ключевой точки — населённый пункт, а не объект: «Соблувка», а не
 * «приют Соблувка». Геокод один на все поверхности — `reverseGeocodePoint`
 * (#1738): язык из активной локали, Nominatim → BigDataCloud, кэш React Query.
 * Раньше здесь жила третья копия с жёсткой `'ru'` и своим web-guard (#1742).
 */
const pickLocalityName = (data: ReverseGeocodePointResult | null): string | null => {
  if (!data) return null
  const { city, adminRegion } = buildGeocodeParts(data)
  const locality =
    city ||
    data.address?.hamlet ||
    // BigDataCloud: `locality` — населённый пункт (в `buildGeocodeParts` он читается как улица).
    data.locality ||
    data.name ||
    // Голый номер дома названием не становится — правило общее (#1717).
    pickDisplayNameSegment(data.display_name) ||
    adminRegion ||
    null
  return locality ? String(locality) : null
}

const fetchReverseName = async (lat: number, lng: number): Promise<string | null> => {
  try {
    return pickLocalityName(await reverseGeocodePoint(lat, lng))
  } catch {
    return null
  }
}

const fetchNearestPeakName = async (lat: number, lng: number): Promise<string | null> => {
  // Overpass intermittently returns 504 on web and logs console errors.
  // Keep UX stable by using reverse-geocoding fallback there.
  if (Platform.OS === 'web') return null
  const query = `[out:json][timeout:20];node(around:5000,${lat},${lng})["natural"="peak"]["name"];out body 1;`
  try {
    const response = await overpassQuery(query)
    if (!response.ok) return null
    const data = await response.json()
    const first = Array.isArray(data?.elements) ? data.elements[0] : null
    const rawName = first?.tags?.name
    if (!rawName) return null
    return String(rawName)
  } catch {
    return null
  }
}

interface RoutePoint {
  coord?: string
  elevation?: number
}

export function useKeyPointLabels(primaryRoutePreview: ParsedRoutePreview | null) {
  const [keyPointLabels, setKeyPointLabels] = useState<KeyPointLabels>({})

  useEffect(() => {
    let active = true
    const linePoints = Array.isArray(primaryRoutePreview?.linePoints)
      ? (primaryRoutePreview?.linePoints as RoutePoint[])
      : []
    if (!linePoints || linePoints.length < 2) {
      // Без смены ссылки на уже пустой объект: новый `{}` на каждый прогон
      // эффекта зацикливал бы рендер у потребителя с нестабильным preview.
      setKeyPointLabels((prev) => (Object.keys(prev).length === 0 ? prev : {}))
      return () => {
        active = false
      }
    }

    const startCoord = parseCoord(String(linePoints[0]?.coord ?? ''))
    const finishCoord = parseCoord(String(linePoints[linePoints.length - 1]?.coord ?? ''))

    let peakPoint: RoutePoint | null = linePoints[0] ?? null
    for (const p of linePoints) {
      if (
        Number.isFinite(p?.elevation) &&
        (!Number.isFinite(peakPoint?.elevation) || Number(p.elevation) > Number(peakPoint?.elevation))
      ) {
        peakPoint = p
      }
    }
    const peakCoord = parseCoord(String(peakPoint?.coord ?? ''))

    const loadLabels = async () => {
      const [startName, finishName] = await Promise.all([
        startCoord ? fetchReverseName(startCoord.lat, startCoord.lng) : Promise.resolve(null),
        finishCoord ? fetchReverseName(finishCoord.lat, finishCoord.lng) : Promise.resolve(null),
      ])

      let peakName: string | null = null
      if (peakCoord) {
        peakName = await fetchNearestPeakName(peakCoord.lat, peakCoord.lng)
        if (!peakName) {
          peakName = await fetchReverseName(peakCoord.lat, peakCoord.lng)
        }
      }

      if (!active) return
      setKeyPointLabels({ startName, peakName, finishName })
    }

    void loadLabels()
    return () => {
      active = false
    }
  }, [primaryRoutePreview])

  // Та же дисциплина, что у эффекта: уже пустой объект не пересоздаём — иначе
  // useMemo списка карт у потребителя пересчитывается на каждый переход между статьями.
  const resetKeyPointLabels = useCallback(
    () => setKeyPointLabels((prev) => (Object.keys(prev).length === 0 ? prev : {})),
    [],
  )

  return { keyPointLabels, resetKeyPointLabels }
}
