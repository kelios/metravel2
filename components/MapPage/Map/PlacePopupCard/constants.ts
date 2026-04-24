export type BreakpointKey = 'narrow' | 'compact' | 'default';

export const POPUP_TOOLTIPS = {
  openPhoto: 'Открыть фото на весь экран',
  copyCoords: 'Скопировать координаты',
  openGoogleMaps: 'Открыть точку в Google Maps',
  openOrganicMaps: 'Открыть точку в Organic Maps',
  openWaze: 'Маршрут в Waze',
  openYandexNavi: 'Маршрут в Яндекс Навигаторе',
  shareTelegram: 'Поделиться точкой в Telegram',
  openArticle: 'Открыть статью по точке',
  buildRoute: 'Построить маршрут сюда',
} as const;

export const escapeCssUrlString = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

export const getBreakpoint = (viewportWidth: number): BreakpointKey => {
  if (viewportWidth <= 480) return 'narrow';
  if (viewportWidth <= 640) return 'compact';
  return 'default';
};

export const FONT_SIZES: Record<BreakpointKey, { title: number; small: number; coord: number }> = {
  narrow: { title: 16, small: 12, coord: 11 },
  compact: { title: 17, small: 12, coord: 12 },
  default: { title: 18, small: 13, coord: 12 },
};

export const SPACING: Record<BreakpointKey, { gap: number; btnPadV: number; btnPadH: number; radius: number; iconButtonSize: number; sectionGap: number }> = {
  narrow: { gap: 7, btnPadV: 7, btnPadH: 12, radius: 16, iconButtonSize: 38, sectionGap: 10 },
  compact: { gap: 9, btnPadV: 8, btnPadH: 14, radius: 18, iconButtonSize: 40, sectionGap: 12 },
  default: { gap: 10, btnPadV: 8, btnPadH: 16, radius: 20, iconButtonSize: 42, sectionGap: 12 },
};

export const COMPACT_LAYOUT_SPACING: Record<BreakpointKey, { radius: number; iconButtonSize: number; sectionGap: number; horizontalPadding: number; topPadding: number; bottomPadding: number; metaMinHeight: number; coordMinHeight: number; addBtnMinHeight: number }> = {
  narrow: { radius: 14, iconButtonSize: 36, sectionGap: 8, horizontalPadding: 10, topPadding: 10, bottomPadding: 10, metaMinHeight: 24, coordMinHeight: 32, addBtnMinHeight: 36 },
  compact: { radius: 16, iconButtonSize: 38, sectionGap: 10, horizontalPadding: 12, topPadding: 12, bottomPadding: 12, metaMinHeight: 26, coordMinHeight: 34, addBtnMinHeight: 38 },
  default: { radius: 16, iconButtonSize: 40, sectionGap: 10, horizontalPadding: 12, topPadding: 12, bottomPadding: 12, metaMinHeight: 26, coordMinHeight: 36, addBtnMinHeight: 40 },
};

export const POPUP_MAX_WIDTH_BY_BREAKPOINT: Record<BreakpointKey, number> = {
  narrow: 286,
  compact: 320,
  default: 352,
};

export const COMPACT_POPUP_MAX_WIDTH_BY_BREAKPOINT: Record<BreakpointKey, number> = {
  narrow: 216,
  compact: 236,
  default: 252,
};

export const IMAGE_MAX_HEIGHT_BY_BREAKPOINT: Record<BreakpointKey, number> = {
  narrow: 144,
  compact: 172,
  default: 196,
};

export const COMPACT_IMAGE_MAX_HEIGHT_BY_BREAKPOINT: Record<BreakpointKey, number> = {
  narrow: 96,
  compact: 112,
  default: 120,
};

export const SPLIT_LAYOUT_MIN_VIEWPORT = 860;
export const SPLIT_LAYOUT_MIN_POPUP_WIDTH = 380;
export const SPLIT_LAYOUT_IMAGE_ASPECT = 1;

export const IMAGE_ASPECT: Record<BreakpointKey, number> = {
  narrow: 1.2,
  compact: 1.3,
  default: 1.35,
};
