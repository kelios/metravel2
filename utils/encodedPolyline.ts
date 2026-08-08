// utils/encodedPolyline.ts
// Декодер encoded polyline (алгоритм Google) для маршрутных провайдеров.
// Различаются только точность координат (5 у ORS/OSRM, 6 у Valhalla) и число
// измерений: третье — высота, ORS отдаёт её при `elevation: true`.

export interface DecodeEncodedPolylineOptions {
  /** Десятичных знаков в координатах: 5 — ORS/OSRM/Google, 6 — Valhalla. */
  precision?: number
  /** 2 → [lng, lat]; 3 → [lng, lat, elevationM]. */
  dimensions?: 2 | 3
}

// Высота кодируется в сантиметрах независимо от точности координат.
const ELEVATION_FACTOR = 100

/**
 * Возвращает `[lng, lat]` или `[lng, lat, elevationM]`. Обрезанная/битая строка
 * не бросает исключение: декодирование останавливается на последней целой точке.
 */
export const decodeEncodedPolyline = (
  encoded: string,
  { precision = 5, dimensions = 2 }: DecodeEncodedPolylineOptions = {},
): number[][] => {
  if (typeof encoded !== 'string' || encoded.length === 0) return []

  const coordFactor = 10 ** precision
  const withElevation = dimensions > 2
  const points: number[][] = []
  let index = 0
  let lat = 0
  let lng = 0
  let elevation = 0

  const readDelta = (): number | null => {
    let shift = 0
    let result = 0
    let byte = 0
    do {
      if (index >= encoded.length) return null
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    return result & 1 ? ~(result >> 1) : result >> 1
  }

  while (index < encoded.length) {
    const latDelta = readDelta()
    const lngDelta = readDelta()
    if (latDelta == null || lngDelta == null) break
    lat += latDelta
    lng += lngDelta

    if (!withElevation) {
      points.push([lng / coordFactor, lat / coordFactor])
      continue
    }

    const elevationDelta = readDelta()
    if (elevationDelta == null) break
    elevation += elevationDelta
    points.push([lng / coordFactor, lat / coordFactor, elevation / ELEVATION_FACTOR])
  }

  return points
}
