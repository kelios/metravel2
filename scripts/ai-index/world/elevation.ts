/**
 * Набор высоты по профилю (#3357, решение D). Чистые функции: вход — высоты в точках с равным шагом
 * вдоль маршрута, выход — набор, сброс, наибольшая и наименьшая высота.
 *
 * Сумма подъёмов по сырому рельефу завышена: тропа на крутом склоне смещена относительно сетки, и шум
 * высот складывается в ложные метры. Поэтому профиль сглаживается скользящим средним, а подъём считается
 * с порогом разворота: спуск меньше порога подъёма не прерывает и в сброс не идёт. Окно и порог
 * подобраны на эталонах (`ASCENT_PARAMS`), расчёт вне допуска эталонов факта набора в карточку не даёт.
 */

export interface AscentParams {
  /** Шаг точек профиля, м. */
  stepM: number
  /** Ширина окна скользящего среднего, м (0 — без сглаживания). */
  smoothM: number
  /** Порог разворота, м. */
  thresholdM: number
}

export interface ProfileStats {
  ascent_m: number
  descent_m: number
  max_alt_m: number
  min_alt_m: number
}

/** Скользящее среднее с окном в нечётное число точек; у краёв окно укорачивается. */
export function smoothProfile(elevations: readonly number[], windowPoints: number): number[] {
  const half = Math.max(0, Math.floor((windowPoints - 1) / 2))
  if (!half) return [...elevations]
  const prefix = new Float64Array(elevations.length + 1)
  for (let i = 0; i < elevations.length; i += 1) prefix[i + 1] = prefix[i] + elevations[i]
  return elevations.map((_, i) => {
    const from = Math.max(0, i - half)
    const to = Math.min(elevations.length - 1, i + half)
    return (prefix[to + 1] - prefix[from]) / (to - from + 1)
  })
}

/**
 * Подъём и спуск с порогом разворота. Пока маршрут идёт вверх, каждый метр выше прежней вершины идёт в
 * набор; понижение меньше порога — шум, вершина остаётся прежней; понижение на порог и больше — разворот,
 * оно целиком идёт в сброс. Вниз — зеркально.
 */
export function climb(elevations: readonly number[], thresholdM: number): { ascent: number; descent: number } {
  let ascent = 0
  let descent = 0
  if (!elevations.length) return { ascent, descent }
  let last = elevations[0]
  let direction: 1 | -1 | 0 = 0
  for (let i = 1; i < elevations.length; i += 1) {
    const delta = elevations[i] - last
    if (direction === 1 ? delta > 0 : direction === -1 ? delta < 0 : false) {
      if (delta > 0) ascent += delta
      else descent -= delta
      last = elevations[i]
    } else if (Math.abs(delta) >= thresholdM && delta !== 0) {
      if (delta > 0) ascent += delta
      else descent -= delta
      direction = delta > 0 ? 1 : -1
      last = elevations[i]
    }
  }
  return { ascent, descent }
}

export function profileStats(elevations: readonly number[], params: AscentParams): ProfileStats {
  if (!elevations.length) return { ascent_m: 0, descent_m: 0, max_alt_m: 0, min_alt_m: 0 }
  const window = params.smoothM > 0 ? Math.max(1, Math.round(params.smoothM / params.stepM)) | 1 : 1
  const smooth = smoothProfile(elevations, window)
  const { ascent, descent } = climb(smooth, params.thresholdM)
  let max = -Infinity
  let min = Infinity
  for (const value of smooth) {
    if (value > max) max = value
    if (value < min) min = value
  }
  return { ascent_m: Math.round(ascent), descent_m: Math.round(descent), max_alt_m: Math.round(max), min_alt_m: Math.round(min) }
}

/** Сумма по цепочкам маршрута: набор и сброс складываются, высоты — крайние. */
export function mergeStats(parts: readonly ProfileStats[]): ProfileStats {
  return parts.reduce<ProfileStats>(
    (total, part) => ({
      ascent_m: total.ascent_m + part.ascent_m,
      descent_m: total.descent_m + part.descent_m,
      max_alt_m: Math.max(total.max_alt_m, part.max_alt_m),
      min_alt_m: Math.min(total.min_alt_m, part.min_alt_m),
    }),
    { ascent_m: 0, descent_m: 0, max_alt_m: -Infinity, min_alt_m: Infinity },
  )
}
