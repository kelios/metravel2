// components/map-core/mapPopupStyles.ts
// C2.2: Shared CSS for Leaflet popups used by both map stacks
import { DESIGN_TOKENS } from '@/constants/designSystem';

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
export const getPopupCss = (cssScope: string, colors: PopupColors): string => `
${cssScope} .leaflet-popup-content-wrapper,
${cssScope} .leaflet-popup-tip {
  background: transparent !important;
  opacity: 1 !important;
}
${cssScope} .leaflet-popup-content-wrapper {
  color: ${colors.text} !important;
  border-radius: ${DESIGN_TOKENS.radii.xl}px !important;
  box-shadow: none !important;
  border: 0 !important;
  max-height: 460px !important;
  overflow: hidden !important;
}
${cssScope} .leaflet-popup-content {
  margin: 0 !important;
  color: ${colors.text} !important;
  max-height: 440px !important;
  overflow-y: auto !important;
  width: min(var(--metravel-popup-content-max-width, 352px), calc(100vw - 48px)) !important;
  max-width: min(var(--metravel-popup-content-max-width, 352px), calc(100vw - 48px)) !important;
  border-radius: ${DESIGN_TOKENS.radii.xl}px !important;
}
${cssScope} .leaflet-popup-close-button {
  display: block !important;
  width: 34px !important;
  height: 34px !important;
  line-height: 32px !important;
  text-align: center !important;
  border-radius: 999px !important;
  border: 1px solid ${colors.border} !important;
  background: ${colors.surface} !important;
  top: 10px !important;
  right: 10px !important;
  z-index: 4 !important;
  color: ${colors.text} !important;
  cursor: pointer !important;
  font-size: 16px !important;
  transition: all 0.2s !important;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.16) !important;
}
${cssScope} .leaflet-popup-close-button:hover {
  color: ${colors.text} !important;
  background: ${colors.backgroundSecondary} !important;
  transform: scale(1.05) !important;
}
@media (max-width: 640px) {
  ${cssScope} .leaflet-popup {
    max-width: 92vw !important;
  }
  ${cssScope} .leaflet-popup-content-wrapper {
    max-height: 66vh !important;
  }
  ${cssScope} .leaflet-popup-content {
    width: min(var(--metravel-popup-content-max-width, 320px), calc(100vw - 32px)) !important;
    max-width: min(var(--metravel-popup-content-max-width, 320px), calc(100vw - 32px)) !important;
    max-height: 66vh !important;
    margin: 0 !important;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch !important;
  }
}
@media (max-width: 420px) {
  ${cssScope} .leaflet-popup {
    max-width: calc(100vw - 12px) !important;
  }
  ${cssScope} .leaflet-popup-content-wrapper {
    max-height: 62vh !important;
  }
  ${cssScope} .leaflet-popup-content {
    width: min(var(--metravel-popup-content-max-width, 286px), calc(100vw - 20px)) !important;
    max-width: min(var(--metravel-popup-content-max-width, 286px), calc(100vw - 20px)) !important;
    max-height: 62vh !important;
    margin: 0 !important;
  }
}
@media (max-width: 560px) {
  ${cssScope} .metravel-place-popup--fullscreen-mobile .leaflet-popup-content-wrapper,
  ${cssScope} .metravel-place-popup--fullscreen-mobile .leaflet-popup-tip,
  ${cssScope} .metravel-place-popup--fullscreen-mobile .leaflet-popup-close-button {
    display: none !important;
  }
  ${cssScope} .metravel-place-popup--fullscreen-mobile .leaflet-popup-content {
    margin: 0 !important;
    width: 0 !important;
    max-width: 0 !important;
    height: 0 !important;
    max-height: 0 !important;
    overflow: hidden !important;
  }
}
`;
