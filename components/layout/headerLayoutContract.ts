import { METRICS } from '@/constants/layout'

/**
 * Shared responsive contract for the global web header.
 *
 * The top row becomes compact below desktop, while HeaderContextBar keeps its
 * phone layout only below tablet. The outer header slot must therefore model
 * three bands rather than treating every width above 768 px as wide desktop.
 */
export const HEADER_LAYOUT_BREAKPOINTS = {
  mobileContext: METRICS.breakpoints.tablet,
  compactRow: METRICS.breakpoints.desktop,
} as const

export const HEADER_MEDIA_MAX_WIDTHS = {
  mobile: HEADER_LAYOUT_BREAKPOINTS.mobileContext - 0.02,
  compact: HEADER_LAYOUT_BREAKPOINTS.compactRow - 0.02,
} as const

/**
 * Логотип бренд-строки на web: статичный путь без хеша. Один адрес для
 * `Logo`, `preload` в `app/+html.tsx` и SSG-шелла (`scripts/ssg-skeletons.js`,
 * парность держит `__tests__/scripts/ssg-skeletons.test.ts`).
 */
export const HEADER_LOGO_WEB_SRC = '/assets/icons/logo_yellow_60x60.png'

export type HeaderViewportBand = 'mobile' | 'compact' | 'wide'
// `screen` — только строка экрана без бренд-строки: вложенный экран телефона (#2100).
export type HeaderVariant = `${HeaderViewportBand}-${'bar' | 'nobar' | 'screen'}`

const HEADER_ROW_HEIGHT: Record<HeaderViewportBand, number> = {
  mobile: 64,
  compact: 64,
  wide: 78,
}

const HEADER_CONTEXT_HEIGHT: Record<HeaderViewportBand, number> = {
  mobile: 52,
  compact: 46,
  wide: 46,
}

const HEADER_BORDERS_HEIGHT = 2

export const HEADER_HEIGHT_FALLBACK: Record<HeaderVariant, number> = {
  'mobile-bar': HEADER_ROW_HEIGHT.mobile + HEADER_CONTEXT_HEIGHT.mobile,
  'mobile-nobar': HEADER_ROW_HEIGHT.mobile,
  'compact-bar': HEADER_ROW_HEIGHT.compact + HEADER_CONTEXT_HEIGHT.compact,
  'compact-nobar': HEADER_ROW_HEIGHT.compact,
  'wide-bar': HEADER_ROW_HEIGHT.wide + HEADER_CONTEXT_HEIGHT.wide,
  'wide-nobar': HEADER_ROW_HEIGHT.wide,
  // Строка экрана + нижние рамки шапки и строки (2 px — та же надбавка, что
  // заложена в 64 = 56 + 6 + 2 у бренд-строки); замер #2100 на 390: 54.
  'mobile-screen': HEADER_CONTEXT_HEIGHT.mobile + HEADER_BORDERS_HEIGHT,
  'compact-screen': HEADER_CONTEXT_HEIGHT.compact + HEADER_BORDERS_HEIGHT,
  'wide-screen': HEADER_CONTEXT_HEIGHT.wide + HEADER_BORDERS_HEIGHT,
}

export const getHeaderViewportBand = (width: number): HeaderViewportBand => {
  if (width < HEADER_LAYOUT_BREAKPOINTS.mobileContext) return 'mobile'
  if (width < HEADER_LAYOUT_BREAKPOINTS.compactRow) return 'compact'
  return 'wide'
}

export const getHeaderVariantForBand = (
  band: HeaderViewportBand,
  hasContextBar: boolean,
  hasBrandRow: boolean = true,
): HeaderVariant => {
  if (!hasContextBar) return `${band}-nobar`
  return hasBrandRow ? `${band}-bar` : `${band}-screen`
}

export const getHeaderVariantForWidth = (
  width: number,
  hasContextBar: boolean,
  hasBrandRow: boolean = true,
): HeaderVariant => getHeaderVariantForBand(getHeaderViewportBand(width), hasContextBar, hasBrandRow)

export const isCompactHeaderWidth = (width: number) =>
  width < HEADER_LAYOUT_BREAKPOINTS.compactRow
