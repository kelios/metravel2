import { METRICS } from '@/constants/layout'
import { defineBreakpointLayout } from '@/utils/breakpointLayout'

/**
 * Кнопки компактной заглушки по ширине (#2114, механизм #2112): на телефоне столбиком во
 * всю ширину (до 360 px), на ширине планшета и больше — в ряд. Компактная заглушка часто
 * монтируется ПОСЛЕ ответа данных, а `useResponsive` даёт новому потребителю кадр «до
 * гидратации»: React рисует узкий вариант, широкий первому кадру даёт critical CSS из
 * этого же реестра — первый кадр совпадает с финальным на любой ширине.
 */
export const EMPTY_STATE_LAYOUT = defineBreakpointLayout({
  scope: 'emptyState',
  minWidth: METRICS.breakpoints.tablet,
  blocks: {
    compactActions: {
      narrow: {
        flexDirection: 'column',
        flexWrap: 'nowrap',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        alignSelf: 'center',
        width: '100%',
        maxWidth: 360,
        gap: 8,
      },
      wide: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'auto',
        width: 'auto',
        maxWidth: '100%',
        gap: 12,
      },
    },
  },
})
