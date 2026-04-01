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
    mobileSheet: {
        position: 'absolute' as const,
        zIndex: 1002,
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: '72%',
        backgroundColor: colors.surface,
        borderTopLeftRadius: `${DESIGN_TOKENS.radii.lg}px`,
        borderTopRightRadius: `${DESIGN_TOKENS.radii.lg}px`,
        borderTop: `1px solid ${colors.border}`,
        boxShadow: DESIGN_TOKENS.shadows.modal,
        overflow: 'hidden' as const,
    },
    mobileSheetHandleRow: {
        display: 'flex',
        justifyContent: 'center' as const,
        paddingTop: '8px',
        paddingBottom: '6px',
    },
    mobileSheetHandle: {
        width: '44px',
        height: '4px',
        borderRadius: '999px',
        backgroundColor: colors.border,
    },
    mobileSheetHeader: {
        display: 'flex',
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
        padding: '10px 12px',
        borderBottom: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
    },
    mobileSheetTitle: {
        fontSize: '14px',
        fontWeight: 800,
        color: colors.text,
    },
    mobileSheetClose: {
        border: 'none',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        fontSize: '18px',
        lineHeight: '18px',
        padding: '4px 6px',
        color: colors.textMuted,
    },
    mobileSheetBody: {
        overflowY: 'auto' as const,
        WebkitOverflowScrolling: 'touch' as const,
        padding: '10px 10px 18px',
        maxHeight: 'calc(72vh - 52px)',
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
