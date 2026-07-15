import { translate as i18nT } from '@/i18n';

export type BreakpointKey = 'narrow' | 'compact' | 'default';
export const getPopupTooltips = () => ({
  openPhoto: i18nT('map:components.MapPage.Map.PlacePopupCard.constants.otkryt_foto_na_ves_ekran_01da0d6d'),
  copyCoords: i18nT('map:components.MapPage.Map.PlacePopupCard.constants.skopirovat_koordinaty_e9a43836'),
  openGoogleMaps: i18nT('map:components.MapPage.Map.PlacePopupCard.constants.otkryt_tochku_v_google_maps_52bffb98'),
  openAppleMaps: i18nT('map:components.MapPage.Map.PlacePopupCard.constants.otkryt_tochku_v_apple_maps_3aaef9e0'),
  openOrganicMaps: i18nT('map:components.MapPage.Map.PlacePopupCard.constants.otkryt_tochku_v_organic_maps_655e5ec5'),
  openWaze: i18nT('map:components.MapPage.Map.PlacePopupCard.constants.marshrut_v_waze_c6bb83a0'),
  openYandexMaps: i18nT('map:components.MapPage.Map.PlacePopupCard.constants.otkryt_tochku_v_yandeks_kartah_19fd5c6f'),
  openYandexNavi: i18nT('map:components.MapPage.Map.PlacePopupCard.constants.marshrut_v_yandeks_navigatore_b3082200'),
  openOpenStreetMap: i18nT('map:components.MapPage.Map.PlacePopupCard.constants.otkryt_tochku_v_openstreetmap_545ab72e'),
  shareTelegram: i18nT('map:components.MapPage.Map.PlacePopupCard.constants.podelitsya_tochkoy_v_telegram_7c64d8cb'),
  openArticle: i18nT('map:components.MapPage.Map.PlacePopupCard.constants.otkryt_statyu_po_tochke_80517a01'),
  buildRoute: i18nT('map:components.MapPage.Map.PlacePopupCard.constants.postroit_marshrut_syuda_424cb120'),
  moreNavigation: i18nT('map:components.MapPage.Map.PlacePopupCard.constants.otkryt_v_navigatore_ili_podelitsya_916a0803'),
})

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
  narrow: 188,
  compact: 220,
  default: 248,
};

export const COMPACT_IMAGE_MAX_HEIGHT_BY_BREAKPOINT: Record<BreakpointKey, number> = {
  narrow: 96,
  compact: 112,
  default: 120,
};

// Mobile bottom card (maps.me-style sheet): the photo is the dominant element
// (~70% of the card). It spans the full sheet width, so its height is capped here
// much taller than the narrow Leaflet-popup compact cap above. Still contain+blur.
export const BOTTOM_CARD_IMAGE_MAX_HEIGHT_BY_BREAKPOINT: Record<BreakpointKey, number> = {
  narrow: 372,
  compact: 392,
  default: 412,
};

export const BOTTOM_CARD_IMAGE_ASPECT: Record<BreakpointKey, number> = {
  narrow: 0.92,
  compact: 0.98,
  default: 1.05,
};

export const SPLIT_LAYOUT_MIN_VIEWPORT = 860;
export const SPLIT_LAYOUT_MIN_POPUP_WIDTH = 380;
export const SPLIT_LAYOUT_IMAGE_ASPECT = 1;

export const IMAGE_ASPECT: Record<BreakpointKey, number> = {
  narrow: 1.2,
  compact: 1.3,
  default: 1.35,
};
