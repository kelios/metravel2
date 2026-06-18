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

export const DEFAULT_MAP_CENTER = {
  latitude: 53.9006,
  longitude: 27.5590,
} as const;

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
