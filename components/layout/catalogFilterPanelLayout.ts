import { CATALOG_FILTER_PANEL } from '@/components/layout/catalogFilterPanelGeometry'
import { defineBreakpointLayout } from '@/utils/breakpointLayout'

export const CATALOG_FILTER_PANEL_LAYOUT = defineBreakpointLayout({
  scope: 'catalog-filter-panel',
  minWidth: CATALOG_FILTER_PANEL.wideMinWidth,
  blocks: {
    aside: {
      narrow: { width: CATALOG_FILTER_PANEL.regularWidth },
      wide: { width: CATALOG_FILTER_PANEL.wideWidth },
    },
    content: {
      narrow: { gap: CATALOG_FILTER_PANEL.regularGap },
      wide: { gap: CATALOG_FILTER_PANEL.wideGap },
    },
  },
})
