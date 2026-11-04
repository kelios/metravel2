/* global module */
/** Shared by the web catalog runtime and the Node search-shell exporter. */
const CATALOG_FILTER_PANEL = Object.freeze({
  embeddedMinWidth: 1024,
  wideMinWidth: 1280,
  regularWidth: 280,
  wideWidth: 320,
  regularGap: 16,
  wideGap: 24,
  padding: 16,
});

function getCatalogFilterPanelGeometry(width) {
  const { embeddedMinWidth, wideMinWidth, regularWidth, wideWidth, regularGap, wideGap } = CATALOG_FILTER_PANEL;
  if (width < embeddedMinWidth) return { width: 0, gap: 0 };
  return width < wideMinWidth ? { width: regularWidth, gap: regularGap } : { width: wideWidth, gap: wideGap };
}

module.exports = { CATALOG_FILTER_PANEL, getCatalogFilterPanelGeometry };
