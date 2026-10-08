import { METRICS } from '@/constants/layout'
import { defineBreakpointLayout } from '@/utils/breakpointLayout'
import { buildWebDockReserveCss } from './bottomDockItemDefs'

// Match Footer/useResponsive, not the root's separate768px content split.
export const WEB_MOBILE_DOCK_LAYOUT = defineBreakpointLayout({
  scope: 'web-mobile-dock',
  minWidth: METRICS.breakpoints.desktop,
  blocks: { shell: { narrow: { display: 'flex' }, wide: { display: 'none' } } },
})
/** First-frame reserve follows the same visibility breakpoint as the dock. */
export const WEB_MOBILE_DOCK_MEDIA_MAX_WIDTH = WEB_MOBILE_DOCK_LAYOUT.minWidth - 0.02
export const WEB_MOBILE_DOCK_RESERVE_CSS = buildWebDockReserveCss(WEB_MOBILE_DOCK_MEDIA_MAX_WIDTH)
export const WEB_DESKTOP_FOOTER_LAYOUT = defineBreakpointLayout({
  scope: 'web-desktop-footer',
  minWidth: WEB_MOBILE_DOCK_LAYOUT.minWidth,
  blocks: { shell: { narrow: { display: 'none' }, wide: { display: 'flex' } } },
})
export const WEB_MOBILE_DOCK_LABEL_LAYOUT = defineBreakpointLayout({
  scope: 'web-mobile-dock-label',
  minWidth: 391,
  blocks: { text: { narrow: { fontSize: 10, lineHeight: 12 }, wide: { fontSize: 11, lineHeight: 13 } } },
})

export const WEB_MOBILE_DOCK_SIDE_PADDING = { compact: 2, regular: 4 } as const
export const WEB_MOBILE_DOCK_SIDE_PADDING_CSS = `@media (min-width:${WEB_MOBILE_DOCK_LABEL_LAYOUT.minWidth}px){[data-testid="web-mobile-dock-shell"] [data-testid="footer-dock-wrapper"]{padding-left:${WEB_MOBILE_DOCK_SIDE_PADDING.regular}px !important;padding-right:${WEB_MOBILE_DOCK_SIDE_PADDING.regular}px !important}[data-testid="web-mobile-dock-shell"] [data-testid^="footer-item-"]{padding-left:2px !important;padding-right:2px !important}}`
