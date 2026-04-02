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
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.10), 0 2px 6px rgba(0, 0, 0, 0.06) !important;
  border: 1px solid ${colors.border} !important;
  max-height: 400px !important;
  overflow: hidden !important;
}
${cssScope} .leaflet-popup-content {
  margin: ${DESIGN_TOKENS.spacing.sm}px !important;
  color: ${colors.text} !important;
  max-height: 380px !important;
  overflow-y: auto !important;
  width: min(var(--metravel-popup-content-max-width, 300px), calc(100vw - 48px)) !important;
  max-width: min(var(--metravel-popup-content-max-width, 300px), calc(100vw - 48px)) !important;
}
${cssScope} .leaflet-popup-close-button {
  display: block !important;
  width: 26px !important;
  height: 26px !important;
  line-height: 24px !important;
  text-align: center !important;
  border-radius: 999px !important;
  border: 1px solid ${colors.border} !important;
  background: ${colors.surface} !important;
  top: 6px !important;
  right: 6px !important;
  z-index: 2 !important;
  color: ${colors.textMuted} !important;
  cursor: pointer !important;
  font-size: 16px !important;
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
    max-height: 60vh !important;
  }
  ${cssScope} .leaflet-popup-content {
    width: min(var(--metravel-popup-content-max-width, 280px), calc(100vw - 32px)) !important;
    max-width: min(var(--metravel-popup-content-max-width, 280px), calc(100vw - 32px)) !important;
    max-height: calc(60vh - 12px) !important;
    margin: ${DESIGN_TOKENS.spacing.xs}px !important;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch !important;
  }
}
@media (max-width: 420px) {
  ${cssScope} .leaflet-popup {
    max-width: calc(100vw - 12px) !important;
  }
  ${cssScope} .leaflet-popup-content-wrapper {
    max-height: 55vh !important;
  }
  ${cssScope} .leaflet-popup-content {
    width: min(var(--metravel-popup-content-max-width, 240px), calc(100vw - 20px)) !important;
    max-width: min(var(--metravel-popup-content-max-width, 240px), calc(100vw - 20px)) !important;
    max-height: calc(55vh - 8px) !important;
    margin: 4px !important;
  }
}
`;
