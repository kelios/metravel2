import { METRICS } from '@/constants/layout'
import { defineBreakpointLayout } from '@/utils/breakpointLayout'

/** Share the landing's first-frame geometry between React and critical CSS. */
export const BECOME_AUTHOR_LAYOUT = defineBreakpointLayout({
  scope: 'become-author',
  minWidth: METRICS.breakpoints.tablet,
  blocks: {
    action: {
      narrow: { alignItems: 'stretch' },
      wide: { alignItems: 'flex-start' },
    },
    card: {
      narrow: { flexBasis: '100%' },
      wide: { flexBasis: '46%' },
    },
  },
})
