import { DESIGN_TOKENS } from '@/constants/designSystem'
import { defineBreakpointLayout } from '@/utils/breakpointLayout'

// Leave room for the navigation, reading/map content and the promotion rail.
export const QUEST_PAGE_COLUMNS_MIN_WIDTH = 1600
export const QUEST_PROMOTION_RAIL_WIDTH = 280

/** Public pages share the catalogue's mobile navigation affordance. */
export const QUEST_PUBLIC_NAV_LAYOUT = defineBreakpointLayout({
  scope: 'quest-public-nav',
  minWidth: 768,
  blocks: {
    toolbar: { narrow: { display: 'flex' }, wide: { display: 'none' } },
  },
})

/** One registry for the SSR first frame and the live reading/promotion columns. */
export const QUEST_PAGE_COLUMNS_LAYOUT = defineBreakpointLayout({
  scope: 'quest-page',
  minWidth: QUEST_PAGE_COLUMNS_MIN_WIDTH,
  blocks: {
    columns: {
      narrow: { flexDirection: 'column', gap: DESIGN_TOKENS.spacing.lg, alignItems: 'stretch' },
      wide: { flexDirection: 'row', gap: DESIGN_TOKENS.spacing.lg, alignItems: 'flex-start' },
    },
    main: {
      narrow: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', minWidth: 0 },
      wide: { flexGrow: 1, flexShrink: 1, flexBasis: '0%', minWidth: 0 },
    },
    promotion: {
      narrow: { width: '100%', minWidth: 0, flexShrink: 0, alignSelf: 'stretch' },
      wide: { width: QUEST_PROMOTION_RAIL_WIDTH, minWidth: 0, flexShrink: 0, alignSelf: 'flex-start' },
    },
  },
})
