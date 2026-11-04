import { translate as i18nT } from '@/i18n'
import { formatInteger } from '@/i18n/format'
import { DEFAULT_MAP_CENTER, DEFAULT_RADIUS_KM } from './mapDefaults'

export { DEFAULT_MAP_CENTER, DEFAULT_RADIUS_KM } from './mapDefaults'
/**
 * Map configuration constants
 */

/** Match the integer radius sent by fetchTravelsForMap. */
export function resolveMapRadiusKm(value: string | number): number {
  const radius = Number(value)
  return Number.isFinite(radius) && radius > 0
    ? Number.parseInt(String(radius), 10)
    : DEFAULT_RADIUS_KM
}

export const RADIUS_OPTIONS = [
  { id: '10', name: '10' },
  { id: '25', name: '25' },
  { id: '50', name: '50' },
  { id: '100', name: '100' },
  { id: '200', name: '200' },
] as const;

/** Тот же дефолтный центр в формате Leaflet [lat, lng]. */
export const DEFAULT_MAP_CENTER_TUPLE: [number, number] = [
  DEFAULT_MAP_CENTER.latitude,
  DEFAULT_MAP_CENTER.longitude,
];

/**
 * Само число радиуса строкой. Радиус приходит и числом, и id-строкой опции
 * (`'100'`), поэтому #1468: числовое значение печатает локаль, а нечисловое
 * остаётся как есть — это уже готовая подпись, а не количество.
 */
export function formatRadiusValue(value: string | number | null | undefined): string {
  const raw = typeof value === 'number' ? value : String(value ?? '').trim()
  if (raw === '') return ''
  const numeric = Number(raw)
  return Number.isFinite(numeric) ? formatInteger(numeric) : String(raw)
}

/**
 * Единый формат подписи радиуса («50 км»). Единственный источник форматирования —
 * используется в панели фильтров, мобильном чипе и списке активных фильтров,
 * чтобы не дублировать `${value} км` инлайн в нескольких местах.
 */
export function formatRadiusLabel(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return i18nT('shared:constants.mapConfig.radius_395844b2')
  const str = String(value).trim()
  if (!str) return i18nT('shared:constants.mapConfig.radius_395844b2')
  return i18nT('shared:constants.mapConfig.value1_km_b45e1a6a', { value1: formatRadiusValue(str) })
}
