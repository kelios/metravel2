/**
 * Эталоны сборки внешнего индекса (#3357): четыре маршрута, по которым сверяются длина, набор высоты,
 * ступень нагрузки и сезон. Расчёт набора вне допуска хотя бы на одном эталоне — факта набора (и
 * зависящих от него дней и ступени) в карточках нет: так решено в постановке.
 *
 * Числа — из отчёта об открытых источниках (`.codex-temp/assistant-world-routes/research.md`, раздел 6):
 * английская Википедия и Wikivoyage, сверка 12.11.2026.
 */
import type { LoadStep } from './effort.ts'

export interface ReferenceTrail {
  key: string
  qid: string
  name: string
  /** Отношение OSM (superroute). */
  relation: number
  /** Длина по источникам, км: наименьшее и наибольшее из названных. */
  length_km: [number, number]
  /** Набор высоты по источникам, м; `null` — источники набора не называют (сверки нет). */
  ascent_m: [number, number] | null
  step: LoadStep
  /** Месяцы, целиком лежащие в сезоне по тексту источника, и месяцы, которых сезон хотя бы касается. */
  months_core: number[]
  months_loose: number[]
}

const YEAR = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

export const REFERENCE_TRAILS: readonly ReferenceTrail[] = [
  { key: 'camino', qid: 'Q1029584', name: 'Camino Francés', relation: 2163573, length_km: [750, 782], ascent_m: null, step: 'hike', months_core: YEAR, months_loose: YEAR },
  { key: 'tmb', qid: 'Q24777', name: 'Tour du Mont Blanc', relation: 124456, length_km: [165, 170], ascent_m: [10000, 10600], step: 'trained', months_core: [7, 8], months_loose: [6, 7, 8, 9] },
  { key: 'gr20', qid: 'Q262374', name: 'GR 20', relation: 101692, length_km: [179, 184], ascent_m: [12000, 13000], step: 'alpine', months_core: [6, 7, 8, 9], months_loose: [5, 6, 7, 8, 9, 10] },
  { key: 'whw', qid: 'Q965998', name: 'West Highland Way', relation: 16287, length_km: [153, 155], ascent_m: [3155, 3155], step: 'hike', months_core: YEAR, months_loose: YEAR },
]

/** Допуск сверки: доля от ближайшей границы эталонного диапазона. */
export const REFERENCE_TOLERANCE = { length: 0.03, ascent: 0.05 } as const

/** Значение лежит в диапазоне с допуском: `tolerance` — доля от ближайшей границы. */
export const withinRange = (value: number, [low, high]: readonly [number, number], tolerance: number): boolean =>
  value >= low * (1 - tolerance) && value <= high * (1 + tolerance)

/** Месяцы расчёта согласуются с текстом: все «целые» месяцы сезона названы, лишних вне сезона нет. */
export const monthsAgree = (months: readonly number[] | null | undefined, reference: Pick<ReferenceTrail, 'months_core' | 'months_loose'>): boolean => {
  const own = new Set(months ?? [])
  return reference.months_core.every((month) => own.has(month)) && [...own].every((month) => reference.months_loose.includes(month))
}

export interface ReferenceVerdict {
  key: string
  length: boolean
  ascent: boolean | null
  step: boolean | null
  months: boolean
}

export function checkReference(
  reference: ReferenceTrail,
  actual: { distance_km: number; ascent_m?: number; effort?: LoadStep; months?: readonly number[] | null },
): ReferenceVerdict {
  return {
    key: reference.key,
    length: withinRange(actual.distance_km, reference.length_km, REFERENCE_TOLERANCE.length),
    ascent: reference.ascent_m === null || actual.ascent_m === undefined ? null : withinRange(actual.ascent_m, reference.ascent_m, REFERENCE_TOLERANCE.ascent),
    step: actual.effort === undefined ? null : actual.effort === reference.step,
    months: monthsAgree(actual.months, reference),
  }
}

/** Набор высоты можно класть в карточки: ни один эталон с известным набором не вышел за допуск. */
export const ascentCalibrated = (verdicts: readonly ReferenceVerdict[]): boolean => verdicts.some((verdict) => verdict.ascent === true) && verdicts.every((verdict) => verdict.ascent !== false)
