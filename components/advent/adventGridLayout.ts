import { DESIGN_TOKENS } from '@/constants/designSystem'
import { defineBreakpointLayout } from '@/utils/breakpointLayout'

/** Телефон — 3 плитки в ряд, с 768px — 6; верно до гидратации (#2112), CSS — `utils/criticalCSSBuilder.ts`. */
export const ADVENT_GRID_MIN_WIDTH = 768
export const ADVENT_GRID_GUTTER = DESIGN_TOKENS.spacing.xs / 2

export const ADVENT_GRID_LAYOUT = defineBreakpointLayout({
  scope: 'advent-grid',
  minWidth: ADVENT_GRID_MIN_WIDTH,
  blocks: {
    tile: {
      narrow: { flexBasis: '33.3333%', maxWidth: '33.3333%' },
      wide: { flexBasis: '16.6667%', maxWidth: '16.6667%' },
    },
  },
})
