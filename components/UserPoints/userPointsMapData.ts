import type { ImportedPoint } from '@/types/userPoints'

export function normalizeUserPoints(points: ImportedPoint[] = []) {
  return (points ?? [])
    .map((p: any) => {
      const lat = Number(p?.latitude)
      const lng = Number(p?.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return { ...(p as any), latitude: lat, longitude: lng } as ImportedPoint
    })
    .filter((p: any): p is ImportedPoint => p != null)
}

export function buildUserPointsTravelData(points: ImportedPoint[]) {
  return (points ?? []).map((p: any) => ({
    id: Number(p?.id),
    coord: `${Number(p?.latitude)},${Number(p?.longitude)}`,
    address: String(p?.address ?? ''),
  }))
}

export function getUserPointsCenter(
  center?: { lat: number; lng: number },
  safePoints: ImportedPoint[] = []
) {
  if (center && Number.isFinite(center.lat) && Number.isFinite(center.lng)) {
    return { lat: center.lat, lng: center.lng }
  }

  if (safePoints.length > 0) {
    const sum = safePoints.reduce(
      (acc, p) => {
        acc.lat += p.latitude
        acc.lng += p.longitude
        return acc
      },
      { lat: 0, lng: 0 }
    )
    return { lat: sum.lat / safePoints.length, lng: sum.lng / safePoints.length }
  }

  return { lat: 55.7558, lng: 37.6173 }
}
