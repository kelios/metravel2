/**
 * Map configuration constants
 */

// #215 — шкала «места рядом»: минимум 60 км был слишком крупным. Дали мелкий
// низкий край (10/25) для настоящего «рядом» и до 200 км для широкого охвата
// (400 км покрывало почти всю страну и почти не использовалось). Дефолт — 50 км
// (входит в набор, поэтому сегмент всегда подсвечен).
export const DEFAULT_RADIUS_KM = 50;

export const RADIUS_OPTIONS = [
  { id: '10', name: '10' },
  { id: '25', name: '25' },
  { id: '50', name: '50' },
  { id: '100', name: '100' },
  { id: '200', name: '200' },
] as const;

// Единый Минск-fallback центр карты для случаев «нет реальной геолокации»
// (permission denied / timeout / SSR). ВАЖНО: это один канонический центр —
// раньше разные модули использовали два близких, но разных Минск-центра
// (53.9006/27.559 и 53.8828449/27.7273595), из-за чего «вы здесь» и радиус-круг
// расходились, а fallback мог ошибочно классифицироваться как реальная позиция.
// Все fallback-центры теперь ссылаются сюда.
export const DEFAULT_MAP_CENTER = {
  latitude: 53.9006,
  longitude: 27.559,
} as const

/** Тот же дефолтный центр в формате Leaflet [lat, lng]. */
export const DEFAULT_MAP_CENTER_TUPLE: [number, number] = [
  DEFAULT_MAP_CENTER.latitude,
  DEFAULT_MAP_CENTER.longitude,
];

/**
 * Единый формат подписи радиуса («50 км»). Единственный источник форматирования —
 * используется в панели фильтров, мобильном чипе и списке активных фильтров,
 * чтобы не дублировать `${value} км` инлайн в нескольких местах.
 */
export function formatRadiusLabel(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return 'Радиус'
  const str = String(value).trim()
  if (!str) return 'Радиус'
  return /км$/i.test(str) ? str : `${str} км`
}
