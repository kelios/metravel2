/**
 * Проходимые месяцы маршрута по климатической норме (#3357, решение G). Чистые функции.
 *
 * Маршрут делится на участки по длине; у участка — высота, ниже которой лежит девять десятых его длины, и
 * нормы ближайшей ячейки сетки (температура и осадки по месяцам, высота ячейки). Температура приводится к
 * высоте участка: −6,5 °C на километр. Дальше — простая модель снега по месяцам: осадки при холоде
 * ложатся снегом, тёплый месяц его топит (градусо-дни).
 *
 * Правило:
 *   1. Участок сезонный, если на его высоте за зиму накапливается устойчивый снег — не меньше
 *      `seasonalSweMm` водного эквивалента. Иначе участок проходим круглый год.
 *   2. Месяц сезонного участка проходим, когда расчётный снег сошёл к началу месяца и к его концу не лёг
 *      (не больше `snowFreeMm`) и средняя температура на высоте участка не ниже `minTempC`.
 *   3. Месяц маршрута проходим, когда проходимы все его участки.
 *
 * Это оценка по норме, а не прогноз: в карточке факт подписан источником. Жару, сезон дождей и работу
 * приютов правило не знает. Пустой результат (вечный снег, нет норм) — факта в карточке нет.
 */

export interface SeasonNormals {
  elevation_m: number
  /** Средняя температура по месяцам, °C. */
  t2m: readonly number[]
  /** Осадки по месяцам, мм в сутки. */
  precip_mm_day: readonly number[]
}

export interface SeasonSegment {
  /** Высота участка, м: ниже неё лежит девять десятых его длины (`SEASON_ALTITUDE_QUANTILE`). */
  altitude_m: number
  normals: SeasonNormals
}

export interface SeasonParams {
  /** Падение температуры с высотой, °C на километр. */
  lapseCPerKm: number
  /** Таяние, мм водного эквивалента на градус в сутки. */
  meltMmPerDegDay: number
  /** Ниже `snowBelowC` осадки — снег целиком, выше `rainAboveC` — дождь целиком, между ними — линейно. */
  snowBelowC: number
  rainAboveC: number
  /** Наибольший снег за год, с которого участок считается сезонным, мм. */
  seasonalSweMm: number
  /** Снег, который считается сошедшим, мм. */
  snowFreeMm: number
  /** Наименьшая средняя температура проходимого месяца на сезонном участке, °C. */
  minTempC: number
}

/** Подобраны на четырёх эталонах; границы плато, в которых результат тот же, — в `docs/features/ai-assistant.md`. */
export const SEASON_PARAMS: SeasonParams = {
  lapseCPerKm: 6.5,
  meltMmPerDegDay: 4,
  snowBelowC: -1,
  rainAboveC: 3,
  seasonalSweMm: 250,
  snowFreeMm: 20,
  minTempC: 5,
}

/**
 * Доля длины участка, лежащая ниже его расчётной высоты. Замер 14.11.2026: при трёх четвертях Kepler Track
 * (Новая Зеландия, сезон с конца октября по апрель) выходил «круглый год» — его альпийский гребень лежит в
 * верхней десятой маршрута; при девяти десятых гребень виден, а горные участки Camino Francés с их
 * неустойчивым снегом (расчётный пик до 132 мм) остаются ниже порога сезонного снега.
 */
export const SEASON_ALTITUDE_QUANTILE = 0.9

const DAYS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
/** Предел модели: снег сверх него считается вечным. */
const SWE_CAP_MM = 20_000

export const temperaturesAt = (normals: SeasonNormals, altitudeM: number, lapseCPerKm: number): number[] =>
  normals.t2m.map((value) => value - (lapseCPerKm * (altitudeM - normals.elevation_m)) / 1000)

/** Снег на конец каждого месяца, мм водного эквивалента: установившийся годовой ход (три круга по году). */
export function snowpack(temps: readonly number[], precipMmDay: readonly number[], params: SeasonParams): number[] {
  const swe = new Array<number>(12).fill(0)
  let current = 0
  for (let cycle = 0; cycle < 3; cycle += 1) {
    for (let month = 0; month < 12; month += 1) {
      const t = temps[month]
      const snowShare = Math.min(1, Math.max(0, (params.rainAboveC - t) / (params.rainAboveC - params.snowBelowC)))
      const fallen = precipMmDay[month] * DAYS[month] * snowShare
      const melted = Math.max(0, t) * params.meltMmPerDegDay * DAYS[month]
      current = Math.min(SWE_CAP_MM, Math.max(0, current + fallen - melted))
      swe[month] = current
    }
  }
  return swe
}

export interface SegmentSeason {
  seasonal: boolean
  /** Проходимые месяцы, 1–12. */
  months: number[]
  /** Наибольший расчётный снег за год, мм. */
  peak_swe_mm: number
}

export function segmentSeason(segment: SeasonSegment, params: SeasonParams = SEASON_PARAMS): SegmentSeason {
  const temps = temperaturesAt(segment.normals, segment.altitude_m, params.lapseCPerKm)
  const swe = snowpack(temps, segment.normals.precip_mm_day, params)
  const peak = Math.max(...swe)
  const all = Array.from({ length: 12 }, (_, month) => month + 1)
  if (peak < params.seasonalSweMm) return { seasonal: false, months: all, peak_swe_mm: Math.round(peak) }
  const months = all.filter((number) => {
    const month = number - 1
    const before = swe[(month + 11) % 12]
    return before <= params.snowFreeMm && swe[month] <= params.snowFreeMm && temps[month] >= params.minTempC
  })
  return { seasonal: true, months, peak_swe_mm: Math.round(peak) }
}

/** Месяцы, проходимые на всех участках; `null` — участков нет либо проходимых месяцев не осталось. */
export function passableMonths(segments: readonly SeasonSegment[], params: SeasonParams = SEASON_PARAMS): number[] | null {
  if (!segments.length) return null
  let months = Array.from({ length: 12 }, (_, month) => month + 1)
  for (const segment of segments) {
    const own = new Set(segmentSeason(segment, params).months)
    months = months.filter((month) => own.has(month))
  }
  return months.length ? months : null
}

/** Высота, ниже которой лежит доля `quantile` точек профиля (точки стоят с равным шагом по длине). */
export function altitudeQuantile(elevations: readonly number[], quantile: number): number {
  if (!elevations.length) return 0
  const sorted = [...elevations].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(quantile * sorted.length)))]
}
