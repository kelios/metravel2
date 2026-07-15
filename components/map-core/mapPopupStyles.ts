// components/map-core/mapPopupStyles.ts
// C2.2: Shared CSS for Leaflet popups used by both map stacks
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { translate as i18nT } from '@/i18n'


interface PopupColors {
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  backgroundSecondary: string;
}

/**
 * Returns a CSS string for Leaflet popup styling.
 * @param cssScope - CSS class scope (e.g. '.metravel-travel-map' or '.metravel-map-page')
 * @param colors - themed color values
 */
export const getPopupCss = (cssScope: string, colors: PopupColors): string => i18nT('shared:components.map_core.mapPopupStyles.value1_leaflet_popup_content_wrapper_value2__0abdb3af', { value1: cssScope, value2: cssScope, value3: cssScope, value4: colors.text, value5: DESIGN_TOKENS.radii.xl, value6: cssScope, value7: colors.text, value8: DESIGN_TOKENS.radii.xl, value9: cssScope, value10: colors.border, value11: colors.surface, value12: colors.text, value13: cssScope, value14: colors.text, value15: colors.backgroundSecondary, value16: cssScope, value17: cssScope, value18: cssScope, value19: cssScope, value20: cssScope, value21: cssScope, value22: cssScope, value23: cssScope, value24: cssScope, value25: cssScope });
