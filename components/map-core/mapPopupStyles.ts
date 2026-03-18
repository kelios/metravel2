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
  background: ${colors.surface} !important;
  opacity: 1 !important;
}
${cssScope} .leaflet-popup-content-wrapper {
  color: ${colors.text} !important;
  border-radius: ${DESIGN_TOKENS.radii.lg}px !important;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08) !important;
  border: 1px solid ${colors.border} !important;
  max-height: 480px !important;
  overflow: hidden !important;
}
${cssScope} .leaflet-popup-content {
  margin: ${DESIGN_TOKENS.spacing.md}px !important;
  color: ${colors.text} !important;
  max-height: 460px !important;
  overflow-y: auto !important;
  width: min(var(--metravel-popup-content-max-width, 320px), calc(100vw - 56px)) !important;
  max-width: min(var(--metravel-popup-content-max-width, 320px), calc(100vw - 56px)) !important;
}
${cssScope} .leaflet-popup-close-button {
  display: block !important;
  width: 28px !important;
  height: 28px !important;
  line-height: 26px !important;
  text-align: center !important;
  border-radius: 999px !important;
  border: 1px solid ${colors.border} !important;
  background: ${colors.surface} !important;
  top: 8px !important;
  right: 8px !important;
  z-index: 2 !important;
  color: ${colors.textMuted} !important;
  cursor: pointer !important;
  font-size: 18px !important;
  transition: all 0.2s !important;
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
    max-height: 70vh !important;
  }
  ${cssScope} .leaflet-popup-content {
    width: min(var(--metravel-popup-content-max-width, 300px), calc(100vw - 40px)) !important;
    max-width: min(var(--metravel-popup-content-max-width, 300px), calc(100vw - 40px)) !important;
    max-height: calc(70vh - 16px) !important;
    margin: ${DESIGN_TOKENS.spacing.xs}px !important;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch !important;
  }
}
@media (max-width: 420px) {
  ${cssScope} .leaflet-popup-content-wrapper {
    max-height: 65vh !important;
  }
  ${cssScope} .leaflet-popup-content {
    max-height: calc(65vh - 12px) !important;
  }
}
`;

