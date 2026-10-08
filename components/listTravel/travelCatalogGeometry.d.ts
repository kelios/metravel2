export const BREAKPOINTS: Readonly<{XS:360; SM:480; MOBILE:768; MD:900; TABLET:1024; TABLET_LANDSCAPE:1024; DESKTOP:1440; DESKTOP_LARGE:1920; XXL:2560}>;
export const GRID_COLUMNS: Readonly<{MOBILE:1; TABLET:2; TABLET_LANDSCAPE:3; DESKTOP:4; DESKTOP_LARGE:4}>;
export const CARD_MEDIA_SLOT_RATIO: 1;
export const CARD_GEOMETRY: Readonly<{borderWidth:number;contentPaddingHorizontal:number;contentPaddingTop:number;contentPaddingBottom:number;contentGap:number;titleLineHeight:number;titleLines:number;metaMinHeight:number;metaLineHeight:number;metaPaddingTop:number;metaBadgePaddingTop:number}>;
export function calculateColumns(width:number, orientation?:'portrait'|'landscape'):number;
export function getCatalogViewportGeometry(params:{width:number;usesOverlaySidebar?:boolean;isTablet?:boolean;isPortrait?:boolean}):{width:number;isCardsSingleColumn:boolean;sidebarWidth:number;effectiveWidth:number;gapSize:number;contentPadding:number;gridColumns:number};
export const CATALOG_CHROME_GEOMETRY: Readonly<{headerMinMobile:number;headerMinDesktop:number;compactSearchHeight:number;wideSearchHeight:number;toolbarHeight:number;listPaddingTop:number;rightColumnPaddingTop:number;brandCompactHeight:number;brandWideHeight:number;brandWideBreakpoint:number}>;
