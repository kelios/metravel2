// services/pdf-export/generators/v2/runtime/atlas/types.ts
// Типы и константы атласа путешествий

import type { PdfThemeConfig } from '../../../../themes/PdfThemeConfig'
import type { NormalizedLocation, TravelSectionMeta } from '../types'

// Палитра обложечных «журнальных» цветов для маркировки путешествий на карте/в указателе
export const TRAVEL_PALETTE = [
  '#D2604A',
  '#3F7CAC',
  '#D9A445',
  '#5E8C5A',
  '#A85A8E',
  '#2F7E73',
  '#B23A48',
  '#5C5AA8',
]

// Сколько travel-групп с map-точками нужно, чтобы атлас был полезен
export const MIN_TRAVELS_FOR_ATLAS = 2

// Эвристика пакетирования указателя по страницам
// Каждое путешествие на странице указателя занимает: 2 строки на заголовок + ceil(N/2) строк на 2-колоночный список точек
export const INDEX_ROWS_PER_PAGE = 22

export type AtlasTravelEntry = {
  meta: TravelSectionMeta
  color: string
  travelOrdinal: number
  pointsWithCoords: NormalizedLocation[]
  pointCount: number
  rowsOnIndexPage: number
}

export interface RenderAtlasPagesArgs {
  meta: TravelSectionMeta[]
  theme: PdfThemeConfig
  bookTitle?: string
  startPageNumber: number
  escapeHtml?: (value: string) => string
}
