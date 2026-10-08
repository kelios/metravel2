/* global module */
/** Pure geometry shared by Metro runtime and the Node first-frame builder. */
const BREAKPOINTS = Object.freeze({ XS:360, SM:480, MOBILE:768, MD:900, TABLET:1024, TABLET_LANDSCAPE:1024, DESKTOP:1440, DESKTOP_LARGE:1920, XXL:2560 });
const GRID_COLUMNS = Object.freeze({ MOBILE:1, TABLET:2, TABLET_LANDSCAPE:3, DESKTOP:4, DESKTOP_LARGE:4 });
const CARD_MEDIA_SLOT_RATIO = 1;
const CATALOG_CHROME_GEOMETRY = Object.freeze({ headerMinMobile:50, headerMinDesktop:76, compactSearchHeight:54, wideSearchHeight:62, toolbarHeight:50, listPaddingTop:8, rightColumnPaddingTop:24, brandCompactHeight:64, brandWideHeight:78, brandWideBreakpoint:1280 });
const CARD_GEOMETRY = Object.freeze({ borderWidth:1, contentPaddingHorizontal:12, contentPaddingTop:9, contentPaddingBottom:11, contentGap:4, titleLineHeight:20, titleLines:2, metaMinHeight:18, metaLineHeight:18, metaPaddingTop:1, metaBadgePaddingTop:1 });
function calculateColumns(width, orientation = 'landscape') {
  if (width < BREAKPOINTS.SM) return 1;
  const padding = width >= BREAKPOINTS.DESKTOP ? 0 : width < BREAKPOINTS.XS ? 8 : width < BREAKPOINTS.SM ? 12 : width < BREAKPOINTS.MOBILE ? 16 : width < BREAKPOINTS.TABLET ? 20 : 24;
  let columns = Math.floor((width - padding * 2 + 16) / (240 + 16));
  const maximum = width >= BREAKPOINTS.DESKTOP_LARGE ? GRID_COLUMNS.DESKTOP_LARGE : width >= BREAKPOINTS.DESKTOP ? GRID_COLUMNS.DESKTOP : width >= BREAKPOINTS.TABLET ? GRID_COLUMNS.TABLET_LANDSCAPE : width >= BREAKPOINTS.MOBILE ? GRID_COLUMNS.TABLET : Infinity;
  columns = Math.min(columns, maximum);
  if (orientation === 'portrait' && width >= BREAKPOINTS.SM && width < BREAKPOINTS.DESKTOP) columns = Math.min(columns, 2);
  return Math.max(columns, 1);
}
function getCatalogViewportGeometry({width, usesOverlaySidebar = width < BREAKPOINTS.DESKTOP, isTablet = width >= BREAKPOINTS.TABLET && width < BREAKPOINTS.DESKTOP, isPortrait = false}) {
  const isCardsSingleColumn = width < BREAKPOINTS.MOBILE;
  const sidebarWidth = usesOverlaySidebar ? 0 : Math.round(Math.min(340, Math.max(260, width * .2)));
  const effectiveWidth = width - sidebarWidth;
  const gapSize = effectiveWidth < BREAKPOINTS.XS ? 6 : effectiveWidth < BREAKPOINTS.SM ? 8 : effectiveWidth < BREAKPOINTS.MOBILE ? 10 : effectiveWidth < BREAKPOINTS.TABLET ? 12 : effectiveWidth < BREAKPOINTS.DESKTOP ? 14 : 16;
  const contentPadding = effectiveWidth < BREAKPOINTS.XS ? 8 : effectiveWidth < BREAKPOINTS.SM ? 10 : effectiveWidth < BREAKPOINTS.TABLET ? 12 : effectiveWidth < BREAKPOINTS.DESKTOP ? 14 : effectiveWidth < BREAKPOINTS.DESKTOP_LARGE ? 16 : 20;
  let gridColumns = isCardsSingleColumn ? 1 : calculateColumns(usesOverlaySidebar ? width : effectiveWidth, (usesOverlaySidebar || isTablet) && isPortrait ? 'portrait' : 'landscape');
  if (!usesOverlaySidebar && effectiveWidth >= BREAKPOINTS.DESKTOP_LARGE) gridColumns = Math.min(gridColumns, 4);
  else if (!usesOverlaySidebar && effectiveWidth >= BREAKPOINTS.DESKTOP) gridColumns = Math.min(gridColumns, 3);
  return {width, isCardsSingleColumn, sidebarWidth, effectiveWidth, gapSize, contentPadding, gridColumns};
}

module.exports = { BREAKPOINTS, GRID_COLUMNS, CARD_MEDIA_SLOT_RATIO, CARD_GEOMETRY, CATALOG_CHROME_GEOMETRY, calculateColumns, getCatalogViewportGeometry };
