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

export type HeaderViewportBand = 'mobile' | 'compact' | 'wide'
export type HeaderVariant = `${HeaderViewportBand}-${'bar' | 'nobar'}`

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

export const HEADER_HEIGHT_FALLBACK: Record<HeaderVariant, number> = {
  'mobile-bar': HEADER_ROW_HEIGHT.mobile + HEADER_CONTEXT_HEIGHT.mobile,
  'mobile-nobar': HEADER_ROW_HEIGHT.mobile,
  'compact-bar': HEADER_ROW_HEIGHT.compact + HEADER_CONTEXT_HEIGHT.compact,
  'compact-nobar': HEADER_ROW_HEIGHT.compact,
  'wide-bar': HEADER_ROW_HEIGHT.wide + HEADER_CONTEXT_HEIGHT.wide,
  'wide-nobar': HEADER_ROW_HEIGHT.wide,
}

export const getHeaderViewportBand = (width: number): HeaderViewportBand => {
  if (width < HEADER_LAYOUT_BREAKPOINTS.mobileContext) return 'mobile'
  if (width < HEADER_LAYOUT_BREAKPOINTS.compactRow) return 'compact'
  return 'wide'
}

export const getHeaderVariantForBand = (
  band: HeaderViewportBand,
  hasContextBar: boolean,
): HeaderVariant => `${band}-${hasContextBar ? 'bar' : 'nobar'}`

export const getHeaderVariantForWidth = (
  width: number,
  hasContextBar: boolean,
): HeaderVariant => getHeaderVariantForBand(getHeaderViewportBand(width), hasContextBar)

export const isCompactHeaderWidth = (width: number) =>
  width < HEADER_LAYOUT_BREAKPOINTS.compactRow
