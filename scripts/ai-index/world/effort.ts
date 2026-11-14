/**
 * Ступень нагрузки маршрута (#3357, решение F) — её считает код, не модель. Чистые функции.
 *
 * Слагаемые:
 *   - усилие, «километры усилия»: длина в километрах плюс набор высоты в сотнях метров;
 *   - дни: число этапов источника, когда этапы похожи на дневные переходы и согласуются с оценкой от
 *     усилия, иначе сама оценка (помечается как оценка);
 *   - крутизна: метры набора на километр длины — она не зависит от того, известны ли дни;
 *   - технический класс: старший класс `sac_scale`, которым размечена заметная часть маршрута;
 *   - наибольшая высота.
 *
 * Усилие в день при оценочных днях близко к норме по построению, поэтому ступень опирается ещё и на
 * крутизну, класс тропы и высоту. Пороги проверены на четырёх эталонах: West Highland Way и Camino
 * Francés — «поход», Tour du Mont Blanc — «поход для подготовленных», GR 20 — «нужен горный опыт».
 */
import { LOAD_STEP_RU, LOAD_STEPS, type LoadStep, SAC_SCALE, type SacScale } from '../../../api/aiAssist/trailFacts.ts'

// Ступени и их подписи — один словарь со службой и экраном (`api/aiAssist/trailFacts.ts`).
export { LOAD_STEP_RU, LOAD_STEPS, type LoadStep }

export const EFFORT_THRESHOLDS = {
  /** Усилие дня, по которому оцениваются дни: обычная тропа, тропа класса T3, класс T4 и выше. */
  dailyEffort: { plain: 30, demanding: 25, alpine: 20 },
  /**
   * Этапы источника считаются днями, когда средний этап лежит в этих пределах, км, а их число расходится
   * с оценкой от усилия не больше чем в `ratio` раз: четыре участка Weg der Schweiz по 9 км — не четыре дня.
   */
  stageKm: { min: 8, max: 35, ratio: 1.5 },
  /** «Прогулка»: всё усилие маршрута не больше одного лёгкого дня и высота ниже порога. */
  walk: { effortKm: 25, maxAltM: 2000 },
  /** «Поход для подготовленных»: любое из условий. */
  trained: { steepnessMPerKm: 30, effortPerDay: 32, maxAltM: 2500 },
  /** Класс `sac_scale` задаёт ступень, когда им размечено не меньше этой доли длины и не меньше `minKm`. */
  sac: { share: 0.02, minKm: 0.5 },
} as const

const sacIndex = (scale: SacScale | null | undefined): number => (scale ? SAC_SCALE.indexOf(scale) : -1)
const T1 = SAC_SCALE.indexOf('hiking')
const T3 = SAC_SCALE.indexOf('demanding_mountain_hiking')
const T4 = SAC_SCALE.indexOf('alpine_hiking')

/** Старший класс `sac_scale`, которым размечена заметная часть маршрута: один помеченный мостик класс не задаёт. */
export function sacGrade(sacKm: Partial<Record<SacScale, number>>, lengthKm: number): SacScale | null {
  const need = Math.max(EFFORT_THRESHOLDS.sac.minKm, lengthKm * EFFORT_THRESHOLDS.sac.share)
  let above = 0
  for (let index = SAC_SCALE.length - 1; index >= 0; index -= 1) {
    above += sacKm[SAC_SCALE[index]] ?? 0
    if (above >= need) return SAC_SCALE[index]
  }
  return null
}

/** «Километры усилия»: километр длины и сто метров набора весят одинаково. */
export const effortKm = (distanceKm: number, ascentM: number): number => Math.round((distanceKm + ascentM / 100) * 10) / 10

export interface EffortInput {
  distance_km: number
  /** Нет набора — ступени нет: по одной длине нагрузку не оценить. */
  ascent_m?: number
  max_alt_m?: number
  sac?: SacScale | null
  /** Длины этапов источника, км. */
  stages_km?: readonly number[]
}

export interface Effort {
  effort_km: number
  days: number
  days_source: 'stages' | 'estimate'
  effort_per_day: number
  steepness_m_per_km: number
  step: LoadStep
  /**
   * Ступень задал класс тропы `sac_scale`: без него по рельефу и усилию она была бы ниже. Разметка класса
   * субъективна, поэтому экран подписывает такую ступень «по разметке OpenStreetMap».
   */
  step_by_grade: boolean
}

/** Этапы источника похожи на дневные переходы: их не меньше двух и средний этап в разумных пределах. */
export function stagesAsDays(stagesKm: readonly number[] | undefined): number | null {
  if (!stagesKm || stagesKm.length < 2) return null
  const mean = stagesKm.reduce((sum, value) => sum + value, 0) / stagesKm.length
  return mean >= EFFORT_THRESHOLDS.stageKm.min && mean <= EFFORT_THRESHOLDS.stageKm.max ? stagesKm.length : null
}

export function estimateEffort(input: EffortInput): Effort | null {
  if (!(input.distance_km > 0) || input.ascent_m === undefined || !(input.ascent_m >= 0)) return null
  const total = effortKm(input.distance_km, input.ascent_m)
  const tech = sacIndex(input.sac)
  const daily = tech >= T4 ? EFFORT_THRESHOLDS.dailyEffort.alpine : tech >= T3 ? EFFORT_THRESHOLDS.dailyEffort.demanding : EFFORT_THRESHOLDS.dailyEffort.plain
  const estimated = Math.max(1, Math.ceil(total / daily))
  const stages = stagesAsDays(input.stages_km)
  const { ratio } = EFFORT_THRESHOLDS.stageKm
  const staged = stages !== null && stages <= estimated * ratio && stages >= estimated / ratio ? stages : null
  const days = staged ?? estimated
  const perDay = Math.round((total / days) * 10) / 10
  const steepness = Math.round(input.ascent_m / input.distance_km)
  const maxAlt = input.max_alt_m ?? 0
  const { walk, trained } = EFFORT_THRESHOLDS
  const stepFor = (grade: number): LoadStep => {
    if (grade >= T4) return 'alpine'
    if (grade >= T3 || steepness >= trained.steepnessMPerKm || perDay > trained.effortPerDay || maxAlt >= trained.maxAltM) return 'trained'
    if (total <= walk.effortKm && grade <= T1 && maxAlt < walk.maxAltM) return 'walk'
    return 'hike'
  }
  const step = stepFor(tech)
  // Без класса тропы (как у маршрута без разметки) ступень была бы другой — значит, её задала разметка.
  const stepByGrade = LOAD_STEPS.indexOf(step) > LOAD_STEPS.indexOf(stepFor(-1))
  return { effort_km: total, days, days_source: staged ? 'stages' : 'estimate', effort_per_day: perDay, steepness_m_per_km: steepness, step, step_by_grade: stepByGrade }
}
