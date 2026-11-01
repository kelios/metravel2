import { buildAnswerChecker } from '@/utils/questAdapters'
import { haversineMeters } from '@/utils/geoDistance'
import type { AdventAnswerPattern, AdventGeoTarget } from '@/types/advent'

/** `locale` — язык, на котором показана загадка (#2883): к правилам RU-источника добавляются правила этого языка. */
export type AdventAnswerChecker = (input: string, locale?: string | null) => boolean

/**
 * Чекер ответа загадки — тот же `buildAnswerChecker`, что и у шагов квестов:
 * нормализация регистра, ё/е, пробелов и словоформ едина для всего сайта (#2862);
 * нормализаторы языка интерфейса (артикли, диакритика) — те же, что у переводов квестов (#2196).
 */
export const buildAdventAnswerChecker = (pattern: AdventAnswerPattern): AdventAnswerChecker => {
  const value = Array.isArray(pattern.value) ? JSON.stringify(pattern.value) : String(pattern.value ?? '')
  const type = pattern.type === 'exact_any' && !Array.isArray(pattern.value) ? 'exact' : pattern.type
  const checker = buildAnswerChecker(type, value)
  return (input: string, locale?: string | null) => {
    const trimmed = String(input ?? '').trim()
    if (trimmed.length === 0) return false
    return checker(trimmed, 'ru') || (!!locale && locale !== 'ru' && checker(trimmed, locale))
  }
}

export type AdventGeoCheck = { hit: boolean; distanceMeters: number }

/** Клик по карте засчитывается внутри радиуса цели; расстояние — гаверсинус квестов. */
export const checkAdventGeoAnswer = (
  target: AdventGeoTarget,
  point: { lat: number; lng: number },
): AdventGeoCheck => {
  const distanceMeters = haversineMeters(target.lat, target.lng, point.lat, point.lng)
  return { hit: distanceMeters <= target.radiusMeters, distanceMeters }
}
