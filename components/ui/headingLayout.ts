import { METRICS } from '@/constants/layout'
import { defineBreakpointLayout, type BreakpointLayout } from '@/utils/breakpointLayout'

/**
 * Типографика `Heading` по ширине, верная ДО гидратации (#2258, механизм #2112).
 *
 * `Heading` растил кегль от брейкпоинта из JS: в статическом HTML (`width = 0`)
 * стоял промежуточный кегль, и после гидратации заголовок на desktop вырастал
 * (/app: `h1` 31 → 38 px, всё ниже съезжало). Теперь значения ступеней — один
 * объект: React берёт их через `headingTypography(level, tier)`, critical CSS
 * выпускает ступени `tablet`/`largeTablet`/`desktop` как `@media (min-width)` по
 * возрастанию (позднее правило побеждает), а узкая ступень — то, что рисует
 * статический HTML, — совпадает с телефоном. Native выбирает те же ступени
 * по живой ширине окна.
 *
 * Ступени повторяют прежнюю логику `fluidSize` из `Typography.tsx` один в один,
 * включая `largeTablet` (1024–1279) с долей 0,35: вид страниц не меняется.
 */
export type HeadingLevel = 1 | 2 | 3 | 4
export type HeadingTier = 'narrow' | 'tablet' | 'largeTablet' | 'desktop'

export const HEADING_SIZES: Record<
  HeadingLevel,
  { minFontSize: number; maxFontSize: number; lineHeightRatio: number; letterSpacing: number }
> = {
  1: { minFontSize: 22, maxFontSize: 32, lineHeightRatio: 1.2, letterSpacing: -0.8 },
  2: { minFontSize: 18, maxFontSize: 24, lineHeightRatio: 1.25, letterSpacing: -0.5 },
  3: { minFontSize: 16, maxFontSize: 20, lineHeightRatio: 1.3, letterSpacing: -0.3 },
  4: { minFontSize: 14, maxFontSize: 16, lineHeightRatio: 1.375, letterSpacing: -0.1 },
}

const TIER_FACTOR: Record<HeadingTier, number> = { narrow: 0, tablet: 0.65, largeTablet: 0.35, desktop: 1 }

export const headingTypography = (level: HeadingLevel, tier: HeadingTier) => {
  const size = HEADING_SIZES[level]
  const fontSize =
    tier === 'narrow' ? size.minFontSize : Math.round(size.minFontSize + (size.maxFontSize - size.minFontSize) * TIER_FACTOR[tier])
  return {
    fontSize,
    lineHeight: Math.round(fontSize * size.lineHeightRatio),
    letterSpacing: tier === 'narrow' ? Math.max(size.letterSpacing * 0.7, -0.5) : size.letterSpacing,
  }
}

type HeadingKey = 'h1' | 'h2' | 'h3' | 'h4'
export const HEADING_LAYOUT_KEY: Record<HeadingLevel, HeadingKey> = { 1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4' }

const TIER_MIN_WIDTH = {
  tablet: METRICS.breakpoints.tablet,
  largeTablet: METRICS.breakpoints.largeTablet,
  desktop: METRICS.breakpoints.desktop,
} as const

const tierLayout = (tier: keyof typeof TIER_MIN_WIDTH): BreakpointLayout<HeadingKey> =>
  defineBreakpointLayout({
    scope: 'heading',
    minWidth: TIER_MIN_WIDTH[tier],
    blocks: {
      h1: { narrow: headingTypography(1, 'narrow'), wide: headingTypography(1, tier) },
      h2: { narrow: headingTypography(2, 'narrow'), wide: headingTypography(2, tier) },
      h3: { narrow: headingTypography(3, 'narrow'), wide: headingTypography(3, tier) },
      h4: { narrow: headingTypography(4, 'narrow'), wide: headingTypography(4, tier) },
    },
  })

/** Ступени по возрастанию ширины: порядок в critical CSS обязателен. */
export const HEADING_LAYOUTS: readonly BreakpointLayout<HeadingKey>[] = [
  tierLayout('tablet'),
  tierLayout('largeTablet'),
  tierLayout('desktop'),
]
