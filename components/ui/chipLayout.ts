import { METRICS } from '@/constants/layout'
import { defineBreakpointLayout } from '@/utils/breakpointLayout'

/**
 * Иконка чипа «только от ширины планшета» (#2157, механизм #2112). Узел иконки
 * есть в разметке на любой ширине, видимость задаёт этот реестр: до гидратации
 * React рисует узкий вариант (`display: none`), широкий первому кадру даёт
 * critical CSS — чип не расширяется, когда после гидратации появляется иконка.
 * Граница — `METRICS.breakpoints.tablet`, та же, что у `isMobile`.
 */
export const CHIP_LAYOUT = defineBreakpointLayout({
  scope: 'chip',
  minWidth: METRICS.breakpoints.tablet,
  blocks: {
    tabletIcon: {
      narrow: { display: 'none' },
      wide: { display: 'flex' },
    },
  },
})
