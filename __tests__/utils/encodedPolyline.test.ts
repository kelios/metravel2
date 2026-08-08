import { decodeEncodedPolyline } from '@/utils/encodedPolyline'
import { decodePolyline6 } from '@/utils/routingHelpers'

// Начало реальной ORS-полилинии (`elevation: true`) маршрута Закопане → Буковина,
// снятой с production `/api/trips/{id}/route-summary/`. Первые точки сверены с
// ascent/descent того же ответа.
const ORS_ELEVATION_POLYLINE = 'yv{kHalwxBk{~CFl@hA?Zp@IVr@BZzIFJ?HF?H??HG?HO?@U?AA?CQsIOM{@'

const encodeSignedValue = (value: number): string => {
  let remaining = value < 0 ? ~(value << 1) : value << 1
  let encoded = ''
  while (remaining >= 0x20) {
    encoded += String.fromCharCode((0x20 | (remaining & 0x1f)) + 63)
    remaining >>= 5
  }
  return encoded + String.fromCharCode(remaining + 63)
}

const encodePolyline = (points: Array<[number, number]>, precision: number): string => {
  const factor = 10 ** precision
  let lastLat = 0
  let lastLng = 0
  let encoded = ''
  for (const [lng, lat] of points) {
    const scaledLat = Math.round(lat * factor)
    const scaledLng = Math.round(lng * factor)
    encoded += encodeSignedValue(scaledLat - lastLat) + encodeSignedValue(scaledLng - lastLng)
    lastLat = scaledLat
    lastLng = scaledLng
  }
  return encoded
}

describe('decodeEncodedPolyline', () => {
  it('reads an ORS elevation polyline as [lng, lat, elevationM]', () => {
    const points = decodeEncodedPolyline(ORS_ELEVATION_POLYLINE, {
      precision: 5,
      dimensions: 3,
    })

    expect(points).toHaveLength(14)
    expect(points.every((point) => point.length === 3)).toBe(true)
    expect(points[0][0]).toBeCloseTo(19.94961, 5)
    expect(points[0][1]).toBeCloseTo(49.29917, 5)
    // Высота приходит в сантиметрах: 81862 → 818.62 м над уровнем моря.
    expect(points[0][2]).toBeCloseTo(818.62, 2)
    expect(points[1][2]).toBeCloseTo(818.25, 2)
    expect(points[13][2]).toBeCloseTo(818, 2)
  })

  it('keeps two dimensions when elevation is not requested', () => {
    const points = decodeEncodedPolyline(encodePolyline([[27.56, 53.9], [27.4, 53.8]], 5), {
      precision: 5,
    })

    expect(points).toEqual([
      [expect.closeTo(27.56, 5), expect.closeTo(53.9, 5)],
      [expect.closeTo(27.4, 5), expect.closeTo(53.8, 5)],
    ])
  })

  it('decodes Valhalla precision-6 shapes unchanged', () => {
    const source: Array<[number, number]> = [
      [27.561234, 53.902345],
      [27.4, 53.8],
      [27.123456, 53.654321],
    ]

    const decoded = decodePolyline6(encodePolyline(source, 6))

    expect(decoded).toHaveLength(3)
    decoded.forEach(([lng, lat], index) => {
      expect(lng).toBeCloseTo(source[index][0], 6)
      expect(lat).toBeCloseTo(source[index][1], 6)
    })
  })

  it('stops at the last complete point instead of throwing on a truncated shape', () => {
    const full = decodeEncodedPolyline(ORS_ELEVATION_POLYLINE, { precision: 5, dimensions: 3 })
    // Обрыв внутри точки: 20 символов покрывают две полные точки и начало третьей.
    const truncated = decodeEncodedPolyline(ORS_ELEVATION_POLYLINE.slice(0, 20), {
      precision: 5,
      dimensions: 3,
    })

    expect(truncated).toHaveLength(2)
    expect(truncated.length).toBeLessThan(full.length)
    expect(truncated[0]).toEqual(full[0])
  })

  it('returns nothing for empty or non-string input', () => {
    expect(decodeEncodedPolyline('')).toEqual([])
    expect(decodeEncodedPolyline(null as unknown as string)).toEqual([])
  })
})
