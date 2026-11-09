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
    address: String(p?.name ?? p?.address ?? ''),
    travelImageThumbUrl: String(p?.photo ?? ''),
    categoryName: String(p?.category ?? ''),
  }))
}

/**
 * Центр карты: геолокация, иначе центр коллекции, иначе `null` — пустая
 * коллекция без геолокации открывает мир, а не зашитую столицу (#3135).
 */
export function getUserPointsCenter(
  center?: { lat: number; lng: number },
  safePoints: ReadonlyArray<{ latitude?: unknown; longitude?: unknown }> = []
): { lat: number; lng: number } | null {
  if (center && Number.isFinite(center.lat) && Number.isFinite(center.lng)) {
    return { lat: center.lat, lng: center.lng }
  }

  // Пины приходят с бэка без нормализации (координата может быть строкой или
  // null): складываем только конечные числа, иначе `+=` склеит строки в NaN.
  // `null`/`''` отсекаем явно — `Number(null)` равен 0 и сдвинул бы центр.
  let latSum = 0
  let lngSum = 0
  let count = 0
  for (const p of safePoints) {
    if (p?.latitude == null || p?.longitude == null || p.latitude === '' || p.longitude === '') continue
    const lat = Number(p.latitude)
    const lng = Number(p.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    latSum += lat
    lngSum += lng
    count += 1
  }
  if (count > 0) return { lat: latSum / count, lng: lngSum / count }

  return null
}

export type UserPointsBounds = [[number, number], [number, number]]

/**
 * Область, куда смотрит карта при открытии: не «все точки до единой», а та их
 * часть, где точек больше всего (#3131). У владельца 2656 точек в Европе и
 * четыре выброса — Карибы, Индия, Мадагаскар, Египет; `fitBounds` по всем
 * давал zoom 1–3 с одним слипшимся пятном и пустыми полосами вне мира.
 *
 * Берём медианный центр (устойчив к выбросам), сортируем точки по удалению от
 * него и строим рамку по ближайшей доле `share` (по умолчанию 90 %). Две точки
 * и меньше — рамка по всем. Возвращает `[[minLat, minLng], [maxLat, maxLng]]`
 * или `null`, если координат нет.
 */
export function getUserPointsFocusBounds(
  points: Array<{ latitude: number; longitude: number }>,
  share = 0.9,
): UserPointsBounds | null {
  const coords = (points ?? [])
    .map((p) => ({ lat: Number(p?.latitude), lng: Number(p?.longitude) }))
    .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng))
  if (coords.length === 0) return null

  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  }
  const centerLat = median(coords.map((c) => c.lat))
  const centerLng = median(coords.map((c) => c.lng))
  const cosLat = Math.max(0.2, Math.cos((centerLat * Math.PI) / 180))

  const keep =
    coords.length <= 2
      ? coords
      : [...coords]
          .map((c) => {
            const dLat = c.lat - centerLat
            // Долгота укорачивается к полюсам: без поправки точки на одной
            // параллели считались бы дальше, чем они есть на местности.
            const dLng = (c.lng - centerLng) * cosLat
            return { c, d: dLat * dLat + dLng * dLng }
          })
          .sort((a, b) => a.d - b.d)
          .slice(0, Math.max(1, Math.ceil(coords.length * Math.min(1, Math.max(0, share)))))
          .map((item) => item.c)

  let minLat = Infinity
  let minLng = Infinity
  let maxLat = -Infinity
  let maxLng = -Infinity
  for (const c of keep) {
    if (c.lat < minLat) minLat = c.lat
    if (c.lat > maxLat) maxLat = c.lat
    if (c.lng < minLng) minLng = c.lng
    if (c.lng > maxLng) maxLng = c.lng
  }
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ]
}
