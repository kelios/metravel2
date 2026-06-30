// [FE-634] T1 — Предрассчитанная геометрия мира для scratch-карты профиля.
// Источник: world-atlas@2 countries-110m (Natural Earth 110m, public domain),
// спроецировано equirectangular (plate carrée) в viewBox 0 0 1000 500.
// Ключ — ISO 3166-1 alpha-2 (uppercase). Поля: d — SVG path, cx/cy — центроид
// крупнейшего полигона (для флаг-маркеров), name — англ. название.
// Покрытие: 175 стран с полигонами. Микрогосударства/мелкие острова (Монако,
// Сингапур, Мальта и т.п.) отсутствуют в 110m — для них маркер ставится отдельно
// (см. T4). Регенерация — scripts из тикета FE-634 (topojson-client + ISO-таблица).

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

export const WORLD_MAP_VIEWBOX = '0 0 1000 500'
export const WORLD_MAP_WIDTH = 1000
export const WORLD_MAP_HEIGHT = 500

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
