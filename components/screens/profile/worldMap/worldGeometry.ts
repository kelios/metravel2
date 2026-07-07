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

// Заливка непосещённой суши. Токен surfaceMuted в светлой теме — near-white frost
// surface token и сливается с белым фоном карты, поэтому для scratch-эффекта
// нужен явный средне-серый, читаемый в обеих темах (нет подходящего токена в палитре).
export const getWorldMapUnvisitedFill = (isDark: boolean): string =>
  isDark ? '#3a3a3a' : '#dce1e6'

const worldCountryGeometry = rawGeometry as Record<string, WorldCountryGeometry>

type PathBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  area: number
}

const parsePathBounds = (path: string): PathBounds | null => {
  const values = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  if (values.length < 4) return null

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (let index = 0; index < values.length - 1; index += 2) {
    const x = values[index]
    const y = values[index + 1]
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }

  const area = Math.max(0, maxX - minX) * Math.max(0, maxY - minY)
  return Number.isFinite(area) && area > 0 ? { minX, minY, maxX, maxY, area } : null
}

const getLargestPathBounds = (d: string): PathBounds | null => {
  const subpaths = d.match(/M[^M]+/g) ?? []
  let largest: PathBounds | null = null

  for (const subpath of subpaths) {
    const bounds = parsePathBounds(subpath)
    if (!bounds || (largest && bounds.area <= largest.area)) continue
    largest = bounds
  }

  return largest
}

const isPointInsideBounds = (
  bounds: PathBounds,
  point: { cx: number; cy: number }
): boolean =>
  point.cx >= bounds.minX &&
  point.cx <= bounds.maxX &&
  point.cy >= bounds.minY &&
  point.cy <= bounds.maxY

/**
 * ISO alpha-2 коды с ПОЛИГОНОМ (d != '') — для отрисовки хорплета.
 * Микрогосударства/острова без полигона в 110m (VA, MU, SG, MC, MT, …) хранятся
 * как центроид-only записи (d='') и сюда НЕ входят, но getCountryGeometry их
 * возвращает — чтобы флаг-маркер (WorldMapFlags) показывался и для них.
 */
export const worldCountryCodes = Object.keys(worldCountryGeometry).filter(
  (code) => worldCountryGeometry[code].d.length > 0
)

/** Геометрия/центроид страны по ISO alpha-2 (регистр не важен). undefined, если кода нет. */
export const getCountryGeometry = (
  code: string | null | undefined
): WorldCountryGeometry | undefined => {
  if (!code) return undefined
  return worldCountryGeometry[code.trim().toUpperCase()]
}

export const getCountryFlagAnchor = (
  code: string | null | undefined
): WorldCountryGeometry | undefined => {
  const geometry = getCountryGeometry(code)
  if (!geometry) return undefined

  const mainBounds = getLargestPathBounds(geometry.d)
  if (!mainBounds || isPointInsideBounds(mainBounds, geometry)) return geometry

  return {
    ...geometry,
    cx: (mainBounds.minX + mainBounds.maxX) / 2,
    cy: (mainBounds.minY + mainBounds.maxY) / 2,
  }
}

export { worldCountryGeometry }
