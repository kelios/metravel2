import type { ParsedRoutePoint } from '@/types/travelRoutes'

export const CHART_HEIGHT = 120
export const CHART_PADDING = 8

export const roundProfileValue = (value: number): number =>
  Math.round(value * 10) / 10

export const formatProfileKm = (value: number): string =>
  `${roundProfileValue(value)} км`

export const formatProfileMeters = (value: number): string =>
  `${Math.round(value)} м`

export const getLocalPointerX = (event: any): number | null => {
  const locationX = event?.nativeEvent?.locationX
  if (typeof locationX === 'number' && Number.isFinite(locationX)) {
    return locationX
  }

  const clientX = event?.clientX
  const bounds = event?.currentTarget?.getBoundingClientRect?.()
  if (typeof clientX === 'number' && bounds) {
    return clientX - bounds.left
  }

  return null
}

type LatLng = { lat: number; lng: number }

export const parseProfileCoord = (coord: string): LatLng | null => {
  const [latStr, lngStr] = String(coord ?? '').replace(/;/g, ',').split(',')
  const lat = Number(latStr)
  const lng = Number(lngStr)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

export const haversineMeters = (a: LatLng, b: LatLng): number => {
  const toRad = (value: number) => (value * Math.PI) / 180
  const radiusMeters = 6371000
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLng / 2)
  const h =
    s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2
  return 2 * radiusMeters * Math.asin(Math.min(1, Math.sqrt(h)))
}

export const resolveNearestHintName = (
  target: LatLng | null,
  placeHints: Array<{ name: string; coord: string }>,
): string | null => {
  if (!target || !Array.isArray(placeHints) || placeHints.length === 0) return null

  const hints = placeHints
    .map((placeHint) => ({
      name: String(placeHint.name ?? '').trim(),
      coord: parseProfileCoord(String(placeHint.coord ?? '')),
    }))
    .filter((hint): hint is { name: string; coord: LatLng } =>
      Boolean(hint.name && hint.coord),
    )

  if (hints.length === 0) return null

  let best: { name: string; dist: number } | null = null
  for (const hint of hints) {
    const dist = haversineMeters(target, hint.coord)
    if (!best || dist < best.dist) {
      best = { name: hint.name, dist }
    }
  }

  if (!best) return null
  return best.dist <= 30000 ? best.name : null
}

export const getPeakRoutePoint = (
  linePoints: ParsedRoutePoint[],
): ParsedRoutePoint | null => {
  if (!Array.isArray(linePoints) || linePoints.length === 0) return null

  let peakPoint = linePoints[0] ?? null
  for (const linePoint of linePoints) {
    if (
      Number.isFinite(linePoint?.elevation as number) &&
      (!Number.isFinite(peakPoint?.elevation as number) ||
        Number(linePoint.elevation) > Number(peakPoint?.elevation))
    ) {
      peakPoint = linePoint
    }
  }

  return peakPoint
}
