import { DESIGN_TOKENS } from '@/constants/designSystem';

export const createWebMapStyles = (colors: any) => ({
    splitLayout: {
        display: 'flex',
        flexDirection: 'row' as const,
        gap: '16px',
        alignItems: 'flex-start' as const,
        width: '100%',
        boxSizing: 'border-box' as const,
    },
    mapPane: {
        flex: '1 1 60%',
        minWidth: 0,
        boxSizing: 'border-box' as const,
    },
    listPane: {
        flex: '0 0 420px',
        maxWidth: '420px',
        border: `1px solid ${colors.border}`,
        borderRadius: `${DESIGN_TOKENS.radii.md}px`,
        padding: `${DESIGN_TOKENS.spacing.md}px`,
        height: '600px',
        overflow: 'hidden' as const,
        backgroundColor: colors.backgroundSecondary,
        boxShadow: DESIGN_TOKENS.shadows.card,
        boxSizing: 'border-box' as const,
    },
    listScrollArea: {
        height: '100%',
        overflowY: 'auto' as const,
        paddingRight: '6px',
    },
    mapCard: {
        border: `1px solid ${colors.border}`,
        borderRadius: `${DESIGN_TOKENS.radii.md}px`,
        overflow: 'hidden' as const,
        backgroundColor: colors.surface,
        boxShadow: DESIGN_TOKENS.shadows.card,
    },
    mobileMapShell: {
        position: 'relative' as const,
    },
    mobileToggleButton: {
        position: 'absolute' as const,
        zIndex: 1001,
        top: '10px',
        right: '10px',
        padding: '8px 12px',
        backgroundColor: colors.primary,
        color: colors.textInverse,
        border: 'none',
        borderRadius: `${DESIGN_TOKENS.radii.pill}px`,
        cursor: 'pointer',
        fontWeight: 700,
        fontSize: '13px',
        boxShadow: DESIGN_TOKENS.shadows.hover,
    },
    mobileListPanel: {
        marginTop: `${DESIGN_TOKENS.spacing.md}px`,
        border: `1px solid ${colors.border}`,
        borderRadius: `${DESIGN_TOKENS.radii.md}px`,
        backgroundColor: colors.backgroundSecondary,
        boxShadow: DESIGN_TOKENS.shadows.card,
        overflow: 'hidden' as const,
    },
    mobileListBody: {
        padding: `${DESIGN_TOKENS.spacing.md}px`,
    },
});

export const buildLeafletPopupCss = (colors: any) => `
    .metravel-webmap .leaflet-popup-content-wrapper,
    .metravel-webmap .leaflet-popup-tip {
      background: ${colors.surface} !important;
      opacity: 1 !important;
    }
    .metravel-webmap .leaflet-popup-content-wrapper {
      color: ${colors.text} !important;
      border-radius: ${DESIGN_TOKENS.radii.lg}px !important;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08) !important;
      border: 1px solid ${colors.border} !important;
      padding: ${DESIGN_TOKENS.spacing.md}px !important;
    }
    .metravel-webmap .leaflet-popup-content {
      margin: 0 !important;
      color: ${colors.text} !important;
      width: 320px !important;
      max-width: calc(100vw - 60px) !important;
    }
    /* PlacePopupCard (FE-MAP M4): cap the popup height so expanding «Ещё» scrolls the
       caption/actions INSIDE the popup instead of growing it off-screen. Mirrors the
       main map's .metravel-place-popup rule, injected here for the wizard page. */
    .metravel-webmap .metravel-place-popup .leaflet-popup-content {
      max-height: calc(100dvh - 120px) !important;
      overflow-y: auto !important;
      -webkit-overflow-scrolling: touch !important;
      overscroll-behavior: contain !important;
    }
    @media (max-width: 640px) {
      .metravel-webmap .leaflet-popup-content {
        width: min(300px, calc(100vw - 40px)) !important;
      }
    }
    .metravel-webmap .leaflet-popup-close-button {
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
      color: ${colors.textMuted} !important;
      font-size: 18px !important;
      transition: all 0.2s !important;
    }
    .metravel-webmap .leaflet-popup-close-button:hover {
      color: ${colors.text} !important;
      background: ${colors.backgroundSecondary} !important;
      transform: scale(1.05) !important;
    }
`;
