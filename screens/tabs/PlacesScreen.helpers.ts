export const MAP_FOCUS_RADIUS_KM = '5'
export const PLACES_PAGE_SIZE = 20
export const LOAD_MORE_SCROLL_THRESHOLD = 420
export const PRESSED_OPACITY = { opacity: 0.72 } as const

export function getPlacesCountLabel(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'место'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'места'
  return 'мест'
}
