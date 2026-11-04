export const CATALOG_FILTER_PANEL: Readonly<{
  embeddedMinWidth: 1024
  wideMinWidth: 1280
  regularWidth: 280
  wideWidth: 320
  regularGap: 16
  wideGap: 24
  padding: 16
}>

export function getCatalogFilterPanelGeometry(width: number): { width: number; gap: number }
