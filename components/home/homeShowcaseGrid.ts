import { METRICS } from '@/constants/layout'

// #2289: витрина «Идеи для ближайших выходных» — ровная сетка одинаковых
// карточек. Порог 2 → 3 колонки — общий `largeTablet` (1024). Порог 1 → 2
// колонки (600) общего источника не имеет: сетка каталога выходит из одной
// колонки только с 768 (`BREAKPOINTS.MOBILE`), а витрина по дизайн-спеке — раньше.
export const SHOWCASE_TWO_COLUMNS_MIN_WIDTH = 600
export const SHOWCASE_MAX_WIDTH = 1136
export const SHOWCASE_GAP = 16
export const SHOWCASE_SINGLE_COLUMN_GAP = 12
// Горизонтальные поля вокруг сетки: 2 × (ResponsiveContainer + рамка витрины
// + border 1) — 600–767: 16 + 16, 768–1023: 32 + 32, от 1024: 40 + 32.
// Полоса скроллбара только сужает сетку, поэтому оценка остаётся СВЕРХУ
// (#1285); единый минимум 66 завышал её на 768–1137 до лишней ступени srcSet.
function getShowcaseHorizontalChrome(viewportWidth: number): number {
  if (viewportWidth >= METRICS.breakpoints.largeTablet) return 146
  if (viewportWidth >= METRICS.breakpoints.tablet) return 130
  return 66
}
// Сколько карточек даёт `fetchTravelsOfMonth({ limit: 6 })`; скелетон держит
// под них столько же слотов, чтобы секции ниже не прыгали после загрузки.
export const SHOWCASE_EXPECTED_ITEMS = 6

export function getShowcaseColumns(viewportWidth: number): number {
  if (viewportWidth >= METRICS.breakpoints.largeTablet) return 3
  if (viewportWidth >= SHOWCASE_TWO_COLUMNS_MIN_WIDTH) return 2
  return 1
}

/** Только полные ряды: одна колонка — до трёх карточек, иначе 2 ряда, 1 ряд или все, если их меньше колонок. */
export function getShowcaseCardCount(available: number, columns: number): number {
  if (columns <= 1) return Math.min(available, 3)
  if (available >= 2 * columns) return 2 * columns
  if (available >= columns) return columns
  return available
}

/**
 * #1487/#1285: оценка ширины карточки СВЕРХУ для `sizes`/srcSet обложки.
 * Фактическая ширина на 768/1024/1280/1440/1920 ≈ 303/277/362/367/368.
 */
export function getShowcaseCardWidth(columns: number, viewportWidth: number): number {
  const gridWidth = Math.min(viewportWidth - getShowcaseHorizontalChrome(viewportWidth), SHOWCASE_MAX_WIDTH)
  return Math.max(1, Math.ceil((gridWidth - (columns - 1) * SHOWCASE_GAP) / columns))
}

export function chunkArray<T>(array: T[], columns: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < array.length; i += columns) result.push(array.slice(i, i + columns))
  return result
}
