import { buildAnswerChecker } from '@/utils/questAdapters'
import { haversineMeters } from '@/utils/geoDistance'
import type { AdventAnswerPattern, AdventGeoTarget } from '@/types/advent'

export type AdventAnswerChecker = (input: string) => boolean

/**
 * Чекер ответа загадки — тот же `buildAnswerChecker`, что и у шагов квестов:
 * нормализация регистра, ё/е, пробелов и словоформ едина для всего сайта (#2862).
 */
export const buildAdventAnswerChecker = (pattern: AdventAnswerPattern): AdventAnswerChecker => {
  const value = Array.isArray(pattern.value) ? JSON.stringify(pattern.value) : String(pattern.value ?? '')
  const type = pattern.type === 'exact_any' && !Array.isArray(pattern.value) ? 'exact' : pattern.type
  const checker = buildAnswerChecker(type, value)
  return (input: string) => {
    const trimmed = String(input ?? '').trim()
    return trimmed.length > 0 && checker(trimmed, 'ru')
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
