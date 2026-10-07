import { METRICS } from '@/constants/layout'
import { defineBreakpointLayout } from '@/utils/breakpointLayout'

// Match Footer/useResponsive, not the root's separate768px content split.
export const WEB_MOBILE_DOCK_LAYOUT = defineBreakpointLayout({
  scope: 'web-mobile-dock',
  minWidth: METRICS.breakpoints.desktop,
  blocks: { shell: { narrow: { display: 'flex' }, wide: { display: 'none' } } },
})
export const WEB_MOBILE_DOCK_LABEL_LAYOUT = defineBreakpointLayout({
  scope: 'web-mobile-dock-label',
  minWidth: 391,
  blocks: { text: { narrow: { fontSize: 10, lineHeight: 12 }, wide: { fontSize: 11, lineHeight: 13 } } },
})

export const WEB_MOBILE_DOCK_SIDE_PADDING = { compact: 2, regular: 4 } as const
export const WEB_MOBILE_DOCK_SIDE_PADDING_CSS = `@media (min-width:${WEB_MOBILE_DOCK_LABEL_LAYOUT.minWidth}px){[data-testid="web-mobile-dock-shell"] [data-testid="footer-dock-wrapper"]{padding-left:${WEB_MOBILE_DOCK_SIDE_PADDING.regular}px !important;padding-right:${WEB_MOBILE_DOCK_SIDE_PADDING.regular}px !important}[data-testid="web-mobile-dock-shell"] [data-testid^="footer-item-"]{padding-left:2px !important;padding-right:2px !important}}`
