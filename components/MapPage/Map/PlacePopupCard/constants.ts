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
  narrow: { title: 15, small: 12, coord: 11 },
  compact: { title: 15, small: 12, coord: 12 },
  default: { title: 16, small: 12, coord: 12 },
};

export const SPACING: Record<BreakpointKey, { gap: number; btnPadV: number; btnPadH: number; radius: number; iconButtonSize: number; sectionGap: number }> = {
  narrow: { gap: 6, btnPadV: 6, btnPadH: 10, radius: 12, iconButtonSize: 34, sectionGap: 8 },
  compact: { gap: 8, btnPadV: 7, btnPadH: 12, radius: 14, iconButtonSize: 36, sectionGap: 10 },
  default: { gap: 8, btnPadV: 7, btnPadH: 14, radius: 14, iconButtonSize: 36, sectionGap: 10 },
};

export const COMPACT_LAYOUT_SPACING: Record<BreakpointKey, { radius: number; iconButtonSize: number; sectionGap: number; horizontalPadding: number; topPadding: number; bottomPadding: number; metaMinHeight: number; coordMinHeight: number; addBtnMinHeight: number }> = {
  narrow: { radius: 10, iconButtonSize: 32, sectionGap: 6, horizontalPadding: 8, topPadding: 8, bottomPadding: 8, metaMinHeight: 22, coordMinHeight: 30, addBtnMinHeight: 32 },
  compact: { radius: 12, iconButtonSize: 34, sectionGap: 8, horizontalPadding: 10, topPadding: 10, bottomPadding: 10, metaMinHeight: 24, coordMinHeight: 32, addBtnMinHeight: 34 },
  default: { radius: 12, iconButtonSize: 36, sectionGap: 8, horizontalPadding: 10, topPadding: 10, bottomPadding: 10, metaMinHeight: 24, coordMinHeight: 34, addBtnMinHeight: 36 },
};

export const POPUP_MAX_WIDTH_BY_BREAKPOINT: Record<BreakpointKey, number> = {
  narrow: 272,
  compact: 296,
  default: 332,
};

export const COMPACT_POPUP_MAX_WIDTH_BY_BREAKPOINT: Record<BreakpointKey, number> = {
  narrow: 216,
  compact: 236,
  default: 252,
};

export const IMAGE_MAX_HEIGHT_BY_BREAKPOINT: Record<BreakpointKey, number> = {
  narrow: 120,
  compact: 144,
  default: 176,
};

export const COMPACT_IMAGE_MAX_HEIGHT_BY_BREAKPOINT: Record<BreakpointKey, number> = {
  narrow: 96,
  compact: 112,
  default: 120,
};

export const SPLIT_LAYOUT_MIN_VIEWPORT = 640;
export const SPLIT_LAYOUT_MIN_POPUP_WIDTH = 300;
export const SPLIT_LAYOUT_IMAGE_ASPECT = 1;

export const IMAGE_ASPECT: Record<BreakpointKey, number> = {
  narrow: 1.2,
  compact: 1.3,
  default: 1.35,
};
