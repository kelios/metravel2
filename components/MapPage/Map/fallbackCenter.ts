// Минск используется как дефолтный центр карты, когда реальной геолокации нет
// (permission denied / timeout). Маркер «вы здесь» НЕ должен рисоваться в этом
// случае — иначе пользователь видит ложную синюю точку в Минске. Признак
// fallback-центра нужен и web-, и native-карте, поэтому вынесен в shared util.
const MINSK_FALLBACK_POINTS: Array<[number, number]> = [
  [53.9006, 27.559],
  [53.8828449, 27.7273595],
]
const MINSK_TOLERANCE = 0.02

export function isFallbackMinskCenter(lat: number, lng: number): boolean {
  return MINSK_FALLBACK_POINTS.some(
    ([fLat, fLng]) => Math.abs(lat - fLat) < MINSK_TOLERANCE && Math.abs(lng - fLng) < MINSK_TOLERANCE,
  )
}
