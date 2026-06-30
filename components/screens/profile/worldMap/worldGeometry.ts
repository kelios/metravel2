// [FE-634 / FE-635 T1] — Предрассчитанная геометрия мира для scratch-карты профиля.
// Источник: world-atlas@2 countries-110m (Natural Earth 110m, public domain),
// спроецировано d3-geo Equal Earth (geoPath с авто-клипом антимеридиана 180°) в
// viewBox 0 0 1000 494 — без полярного растяжения и без штрихов через всю карту.
// Ключ — ISO 3166-1 alpha-2 (uppercase). Поля: d — SVG path, cx/cy — центроид
// (path.centroid, для флаг-маркеров), name — англ. название.
// Покрытие: 175 стран с полигонами. Микрогосударства/мелкие острова (Монако,
// Сингапур, Мальта и т.п.) отсутствуют в 110m — для них маркер ставится отдельно.
// Регенерация: scratchpad build_ee.mjs (d3-geo + topojson-client, build-only).

import rawGeometry from './worldGeometry.json'

export interface WorldCountryGeometry {
  /** SVG path data в координатах viewBox (M…L…Z, multipolygon = несколько подпутей) */
  d: string
  /** X центроида крупнейшего полигона (для флаг-маркера) */
  cx: number
  /** Y центроида крупнейшего полигона */
  cy: number
  /** Англ. название страны из ISO 3166 */
  name: string
}

export const WORLD_MAP_WIDTH = 1000
export const WORLD_MAP_HEIGHT = 494
export const WORLD_MAP_VIEWBOX = `0 0 ${WORLD_MAP_WIDTH} ${WORLD_MAP_HEIGHT}`
/** Соотношение сторон карты (W/H) — для aspectRatio контейнера, чтобы совпадало с viewBox. */
export const WORLD_MAP_ASPECT = WORLD_MAP_WIDTH / WORLD_MAP_HEIGHT

// Заливка непосещённой суши. Токен surfaceMuted в светлой теме — near-white фрост
// (rgba(255,255,255,0.75)) и сливается с белым фоном карты, поэтому для scratch-эффекта
// нужен явный средне-серый, читаемый в обеих темах (нет подходящего токена в палитре).
export const getWorldMapUnvisitedFill = (isDark: boolean): string =>
  isDark ? '#3a3a3a' : '#dce1e6'

const worldCountryGeometry = rawGeometry as Record<string, WorldCountryGeometry>

/** Все ISO alpha-2 коды, для которых есть полигон. */
export const worldCountryCodes = Object.keys(worldCountryGeometry)

/** Геометрия страны по ISO alpha-2 (регистр не важен). undefined, если полигона нет. */
export const getCountryGeometry = (
  code: string | null | undefined
): WorldCountryGeometry | undefined => {
  if (!code) return undefined
  return worldCountryGeometry[code.trim().toUpperCase()]
}

export { worldCountryGeometry }
