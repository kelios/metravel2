import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import type { ParsedRoutePreview } from '@/types/travelRoutes'

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

const fetchReverseName = async (lat: number, lng: number): Promise<string | null> => {
  try {
    const nominatim = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=ru`
    )
    if (nominatim.ok) {
      const data = await nominatim.json()
      const addr = data?.address ?? {}
      const locality =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        addr.suburb ||
        addr.hamlet ||
        data?.name ||
        (typeof data?.display_name === 'string' ? String(data.display_name).split(',')[0]?.trim() : null) ||
        null
      if (locality) return String(locality)
    }
  } catch {
    // fallback below
  }

  // bigdatacloud.net is intentionally blocked by CSP on web.
  if (Platform.OS === 'web') return null

  try {
    const primary = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=ru`
    )
    if (!primary.ok) return null
    const data = await primary.json()
    return (
      data?.city ||
      data?.locality ||
      data?.principalSubdivision ||
      data?.address?.city ||
      data?.address?.town ||
      data?.address?.village ||
      data?.address?.municipality ||
      null
    )
  } catch {
    return null
  }
}

const fetchNearestPeakName = async (lat: number, lng: number): Promise<string | null> => {
  // Overpass intermittently returns 504 on web and logs console errors.
  // Keep UX stable by using reverse-geocoding fallback there.
  if (Platform.OS === 'web') return null
  const endpoint = process.env.EXPO_PUBLIC_OVERPASS_ENDPOINT || 'https://overpass-api.de/api/interpreter'
  const query = `[out:json][timeout:20];node(around:5000,${lat},${lng})["natural"="peak"]["name"];out body 1;`
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: `data=${encodeURIComponent(query)}`,
    })
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
      setKeyPointLabels({})
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

  const resetKeyPointLabels = () => setKeyPointLabels({})

  return { keyPointLabels, resetKeyPointLabels }
}
