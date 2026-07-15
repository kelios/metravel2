// src/screens/tabs/map.styles.ts
import { Platform, StyleSheet } from 'react-native';
import { LAYOUT, METRICS } from '@/constants/layout';
import type { ThemedColors } from '@/hooks/useTheme';

// ✅ Токенизация: базируемся на 8pt-системе METRICS
const PANEL_WIDTH_DESKTOP = METRICS.baseUnit * 45; // 360px
const PANEL_WIDTH_TABLET = METRICS.baseUnit * 40; // 320px
const PANEL_GAP = METRICS.spacing.m; // 16px
const DESKTOP_SHELL_PADDING = METRICS.spacing.m;
const TRANSITION_MS = 200;
const WEB_MOBILE_FOOTER_RESERVE_HEIGHT = LAYOUT?.tabBarHeight ?? 56;
const WEB_HEADER_RESERVED_HEIGHT = 88;
const PANEL_RADIUS = 20;
const CONTROL_RADIUS = 12;
const CONTROL_SIZE = 40;

export const getStyles = (
  isMobile: boolean,
  insetTop: number,
  themedColors: ThemedColors,
) => {
  const shadowMedium = themedColors.shadows.medium;
  const shadowHeavy = themedColors.shadows.heavy;
  const webViewportReservedHeight = isMobile
    ? WEB_MOBILE_FOOTER_RESERVE_HEIGHT
    : WEB_HEADER_RESERVED_HEIGHT;
  const webPointerCursor = Platform.OS === 'web' ? { cursor: 'pointer' as const } : {};

  return StyleSheet.create({
    container: {
      flex: 1,
      ...(Platform.OS === 'web'
        ? ({
            // Height resolution order (see hooks/useMapViewportHeightVar.ts):
            //   1. --metravel-map-vh — JS-measured visible viewport (reliable in
            //      in-app WebViews where `dvh` collapses to 0 -> grey map).
            //   2. 100svh — stable SMALL viewport fallback before the JS var is
            //      set; more reliable than `dvh` in WebViews and equal to the
            //      visible area on Safari/desktop.
            height: `calc(var(--metravel-map-vh, 100svh) - ${webViewportReservedHeight}px)`,
            maxHeight: `calc(var(--metravel-map-vh, 100svh) - ${webViewportReservedHeight}px)`,
            minHeight: 0,
            overflow: 'hidden',
          } as any)
        : null),
      backgroundColor: themedColors.background,
    },
    mapContainer: {
      flex: 1,
      position: 'relative',
      ...(Platform.OS === 'web'
        ? ({
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            columnGap: isMobile ? 0 : PANEL_GAP,
            paddingLeft: isMobile ? 0 : DESKTOP_SHELL_PADDING,
            paddingRight: isMobile ? 0 : DESKTOP_SHELL_PADDING,
            paddingTop: isMobile ? 0 : DESKTOP_SHELL_PADDING - 4,
            paddingBottom: isMobile ? 0 : DESKTOP_SHELL_PADDING - 4,
            height: '100%',
            minHeight: 0,
            minWidth: 0,
            alignItems: 'stretch',
            isolation: 'isolate',
            backgroundColor: themedColors.background,
          } as any)
        : null),
    },
      // #217 — stable host that always wraps the map node so the mobile↔desktop
      // breakpoint flip never re-parents (remounts) Leaflet. On desktop it is the
      // flex sibling to the right of the panel; on mobile it is the full-bleed
      // background under the absolute overlays + bottom sheet.
      mapHost: {
        flex: 1,
        position: 'relative',
        minWidth: 0,
        minHeight: 0,
        ...(Platform.OS === 'web'
          ? ({
              display: 'flex',
              height: '100%',
              minHeight: 0,
            } as any)
          : null),
      },
      mapArea: {
        flex: 1,
        minHeight: isMobile ? 260 : 500,
        position: 'relative',
        zIndex: 0,
        ...(Platform.OS === 'web'
          ? ({
              isolation: 'isolate',
              display: 'flex',
              height: '100%',
              minHeight: isMobile ? 220 : 0,
              minWidth: 0,
              borderRadius: isMobile ? 0 : PANEL_RADIUS,
              overflow: 'hidden',
              backgroundColor: themedColors.surfaceAlpha40,
              borderWidth: isMobile ? 0 : StyleSheet.hairlineWidth,
              borderColor: themedColors.borderLight,
              boxShadow: isMobile ? 'none' : themedColors.boxShadows.card,
            } as any)
          : null),
      },
      rightPanel: {
        position: isMobile ? 'absolute' : 'relative',
        left: isMobile ? 0 : undefined,
        right: isMobile ? 0 : undefined,
        bottom: isMobile ? (Platform.OS === 'web' ? WEB_MOBILE_FOOTER_RESERVE_HEIGHT : 0) : undefined,
        top: isMobile ? undefined : 0,
        width: isMobile ? '100%' : PANEL_WIDTH_DESKTOP,
        maxWidth: isMobile ? '100%' : PANEL_WIDTH_DESKTOP + 40,
        maxHeight: isMobile ? '75vh' : undefined,
        height: isMobile ? undefined : '100%',
        backgroundColor: themedColors.surface,
        minHeight: 0,
        minWidth: 0,
        flexShrink: 0,
        ...(Platform.OS === 'web'
          ? ({
              alignSelf: isMobile ? 'auto' : 'stretch',
              backgroundColor: themedColors.surface,
              boxShadow: isMobile
                ? themedColors.boxShadows.medium
                : themedColors.boxShadows.card,
              // На мобильном живой backdrop-filter поверх скролла убивает GPU —
              // используем статичный фрост (см. CLAUDE.md), блюр только на десктопе.
              ...(isMobile
                ? { backgroundColor: themedColors.surfaceMuted }
                : {
                    backdropFilter: 'blur(20px) saturate(1.05)',
                    WebkitBackdropFilter: 'blur(20px) saturate(1.05)',
                  }),
              borderTopLeftRadius: isMobile ? 18 : PANEL_RADIUS,
              borderTopRightRadius: isMobile ? 18 : PANEL_RADIUS,
              borderBottomLeftRadius: isMobile ? 0 : PANEL_RADIUS,
              borderBottomRightRadius: isMobile ? 0 : PANEL_RADIUS,
              borderWidth: 1,
              borderColor: themedColors.borderLight,
              overflow: isMobile ? 'hidden' : 'visible',
            } as any)
          : Platform.OS === 'ios'
          ? shadowHeavy
          : { elevation: shadowHeavy.elevation }),
        zIndex: 1000,
        ...(Platform.OS === 'web' && !isMobile
          ? ({
              width: `min(${PANEL_WIDTH_DESKTOP}px, 34vw)`,
              minWidth: PANEL_WIDTH_TABLET,
            } as any)
          : null),
        ...(Platform.OS === 'web' && isMobile
          ? ({
              transition: `transform ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            } as any)
          : null),
      },
      overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: isMobile && Platform.OS === 'web' ? WEB_MOBILE_FOOTER_RESERVE_HEIGHT : 0,
        backgroundColor: themedColors.overlay,
        zIndex: 999,
        ...(Platform.OS === 'web'
          ? ({
              transition: `opacity ${TRANSITION_MS}ms ease`,
            } as any)
          : null),
      },
      tabsContainer: {
        flexDirection: 'row',
        flexWrap: 'nowrap',
        alignItems: 'center',
        paddingTop: isMobile ? Math.max(10, insetTop + 2) : 14,
        paddingBottom: isMobile ? 8 : 10,
        paddingHorizontal: isMobile ? 10 : 12,
        backgroundColor: themedColors.surface,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: themedColors.borderLight,
        columnGap: 10,
        minHeight: isMobile ? 48 : undefined,
        ...(Platform.OS === 'web'
          ? ({
              backgroundColor: isMobile ? themedColors.surfaceMuted : themedColors.surface,
              // Статичный фрост на мобильном вместо живого блюра (GPU), см. CLAUDE.md.
              ...(isMobile
                ? null
                : {
                    backdropFilter: 'blur(20px) saturate(1.05)',
                    WebkitBackdropFilter: 'blur(20px) saturate(1.05)',
                  }),
              boxShadow: '0 1px 0 rgba(15,23,42,0.06)',
            } as any)
          : null),
      },
      tabsSegment: {
        flexDirection: 'row',
        backgroundColor: themedColors.backgroundSecondary,
        borderRadius: 14,
        padding: 3,
        columnGap: 2,
        alignSelf: isMobile ? 'flex-start' : 'stretch',
        flex: isMobile ? 0 : 1,
        minWidth: 0,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.borderLight,
      },
      tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: isMobile ? 7 : 8,
        paddingHorizontal: isMobile ? 12 : 7,
        borderRadius: 11,
        gap: isMobile ? 6 : 4,
        minWidth: isMobile ? 48 : undefined,
        minHeight: isMobile ? 34 : 34,
      },
      tabActive: {
        backgroundColor: themedColors.primary,
        ...(Platform.OS === 'web'
          ? ({
              boxShadow: `0 3px 12px ${themedColors.primaryAlpha30}, 0 1px 3px rgba(0,0,0,0.06)`,
            } as any)
          : null),
      },
      tabIconBubble: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: themedColors.surfaceAlpha40,
      },
      tabIconBubbleActive: {
        backgroundColor: themedColors.primaryLight,
      },
      tabText: {
        fontSize: 12,
        fontWeight: '600',
        color: themedColors.textMuted,
        letterSpacing: 0.15,
      },
      tabTextActive: {
        color: themedColors.textOnPrimary,
        fontWeight: '700',
      },
      panelContent: {
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: themedColors.surface,
        ...(Platform.OS === 'web'
          ? ({
              backgroundColor: themedColors.surface,
              borderBottomLeftRadius: isMobile ? 0 : 24,
              borderBottomRightRadius: isMobile ? 0 : 24,
            } as any)
          : null),
      },
      resetButton: {
        flexDirection: 'row',
        gap: 4,
        paddingHorizontal: 10,
        height: CONTROL_SIZE,
        borderRadius: CONTROL_RADIUS,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: themedColors.surfaceAlpha40,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.borderLight,
        ...(Platform.OS === 'web' ? ({
          cursor: 'pointer',
          transition: 'background-color 0.15s ease',
        } as any) : null),
      },
      resetButtonLabel: {
        fontSize: 12,
        color: themedColors.textMuted,
        fontWeight: '500',
      },
      panelHeaderActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        flexShrink: 0,
        gap: 6,
        marginLeft: 8,
        paddingLeft: 8,
        borderLeftWidth: StyleSheet.hairlineWidth,
        borderLeftColor: themedColors.borderLight,
      },
      resetButtonCompact: {
        width: 36,
        minWidth: 36,
        height: 36,
        paddingHorizontal: 0,
      },
      closePanelButton: {
        width: CONTROL_SIZE,
        height: CONTROL_SIZE,
        borderRadius: CONTROL_RADIUS,
        backgroundColor: themedColors.surfaceAlpha40,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.borderLight,
        alignItems: 'center',
        justifyContent: 'center',
        ...(Platform.OS === 'web' ? ({
          cursor: 'pointer',
          transition: 'background-color 0.15s ease',
        } as any) : null),
      },
      fab: {
        position: 'absolute',
        right: 16,
        bottom: 16,
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: themedColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1001,
        ...(Platform.OS === 'web'
          ? ({ boxShadow: `0 4px 16px ${themedColors.primary}50, 0 1px 4px rgba(0,0,0,0.08)` } as any)
          : Platform.OS === 'ios'
          ? shadowMedium
          : { elevation: shadowMedium.elevation }),
      },
      loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: themedColors.overlay,
        zIndex: 1002,
      },
      // Desktop-web floating «Слои» control: a Google-Maps-style round button
      // pinned to the top-right of the map area (NOT over the left panel). Frost
      // surface + shadow, matching the other floating map controls.
      desktopLayersFab: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: themedColors.surfaceMuted,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.borderLight,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1001,
        ...(Platform.OS === 'web'
          ? ({
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(15,23,42,0.18), 0 1px 4px rgba(0,0,0,0.08)',
              transition: 'background-color 0.15s ease',
            } as any)
          : shadowMedium),
      },
      desktopLayersFabActive: {
        backgroundColor: themedColors.surface,
        borderColor: themedColors.primary,
      },
      // Desktop-web floating «Радиус» control: sits in the same top-right cluster
      // as the layers FAB, immediately to its left (44 button + 8 gap).
      desktopRadiusFab: {
        position: 'absolute',
        top: 16,
        right: 16 + 44 + 8,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: themedColors.surfaceMuted,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.borderLight,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1001,
        ...(Platform.OS === 'web'
          ? ({
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(15,23,42,0.18), 0 1px 4px rgba(0,0,0,0.08)',
              transition: 'background-color 0.15s ease',
            } as any)
          : shadowMedium),
      },
      desktopRadiusFabActive: {
        backgroundColor: themedColors.surface,
        borderColor: themedColors.primary,
      },
      desktopRadiusFabBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 4,
        borderRadius: 9,
        backgroundColor: themedColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
      },
      desktopRadiusFabBadgeText: {
        color: themedColors.textOnPrimary,
        fontSize: 10,
        fontWeight: '700',
        lineHeight: 12,
      },
      // Desktop-web «Искать в этой области» pill: centered at the top of the map
      // area, Google-Maps-style. Appears only after the map is panned away from
      // the search anchor (controller-driven canSearchThisArea).
      desktopSearchAreaButton: {
        position: 'absolute',
        top: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        height: 40,
        borderRadius: 20,
        backgroundColor: themedColors.primary,
        zIndex: 1001,
        ...(Platform.OS === 'web'
          ? ({
              left: '50%',
              transform: [{ translateX: '-50%' }],
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(15,23,42,0.18), 0 1px 4px rgba(0,0,0,0.08)',
              transition: 'background-color 0.15s ease',
            } as any)
          : { alignSelf: 'center', ...shadowMedium }),
      },
      desktopSearchAreaButtonText: {
        color: themedColors.textOnPrimary,
        fontSize: 13,
        fontWeight: '600',
      },
      panelPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      },
      panelPlaceholderText: {
        fontSize: 14,
        color: themedColors.textMuted,
      },
      badge: {
        backgroundColor: themedColors.backgroundSecondary,
        borderRadius: 10,
        minWidth: isMobile ? 20 : 18,
        height: isMobile ? 18 : 16,
        paddingHorizontal: isMobile ? 5 : 4,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: isMobile ? 4 : 2,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.borderLight,
      },
      badgeActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.28)',
        borderColor: 'rgba(255,255,255,0.2)',
      },
      badgeText: {
        fontSize: isMobile ? 10 : 9,
        fontWeight: '700',
        color: themedColors.textMuted,
      },
      badgeTextActive: {
        color: themedColors.textOnPrimary,
      },
      collapsedPanel: {
        width: 56,
        flexShrink: 0,
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 12,
        paddingHorizontal: 8,
        gap: 10,
        marginTop: 6,
        marginBottom: 6,
        backgroundColor: themedColors.surface,
        borderRadius: PANEL_RADIUS,
        borderWidth: 1,
        borderColor: themedColors.borderLight,
        ...(Platform.OS === 'web'
          ? ({
              backgroundColor: themedColors.surface,
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              boxShadow: themedColors.boxShadows.card,
            } as any)
          : null),
      },
      collapseToggle: {
        width: CONTROL_SIZE,
        height: CONTROL_SIZE,
        borderRadius: CONTROL_RADIUS,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: themedColors.surfaceAlpha40,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.borderLight,
        ...(Platform.OS === 'web'
          ? ({ cursor: 'pointer', transition: 'background-color 0.15s ease' } as any)
          : null),
      },
      collapseToggleInPanel: {
        position: 'absolute',
        top: 16,
        right: -48,
        width: CONTROL_SIZE,
        height: CONTROL_SIZE,
        borderRadius: CONTROL_RADIUS,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: themedColors.surface,
        borderWidth: 1,
        borderColor: themedColors.border,
        zIndex: 1002,
        ...(Platform.OS === 'web'
          ? ({
              cursor: 'pointer',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: themedColors.boxShadows.medium,
              transition: 'background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease',
            } as any)
          : null),
      },
      collapsedIconBtn: {
        width: CONTROL_SIZE,
        height: CONTROL_SIZE,
        borderRadius: CONTROL_RADIUS,
        alignItems: 'center',
        justifyContent: 'center',
        ...(Platform.OS === 'web'
          ? ({ cursor: 'pointer', transition: 'background-color 0.15s ease' } as any)
          : null),
      },
      collapsedBadge: {
        position: 'absolute',
        top: -3,
        right: -3,
        backgroundColor: themedColors.primary,
        borderRadius: 7,
        minWidth: 14,
        height: 14,
        paddingHorizontal: 3,
        alignItems: 'center',
        justifyContent: 'center',
      },
      collapsedBadgeText: {
        fontSize: 8,
        fontWeight: '700',
        color: themedColors.textOnPrimary,
      },
      resizeHandle: {
        position: 'absolute',
        right: -5,
        top: 0,
        bottom: 0,
        width: 10,
        zIndex: 1003,
        ...(Platform.OS === 'web'
          ? ({ cursor: 'col-resize' } as any)
          : null),
      },
      radiusPill: {
        position: 'absolute',
        top: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: themedColors.surface,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.borderLight,
        zIndex: 1005,
        ...(Platform.OS === 'web'
          ? ({
              backgroundColor: themedColors.surfaceAlpha40,
              backdropFilter: 'blur(14px) saturate(1.08)',
              WebkitBackdropFilter: 'blur(14px) saturate(1.08)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
              cursor: 'pointer',
              transition: 'opacity 0.15s ease',
            } as any)
          : themedColors.shadows.light),
      },
      radiusPillText: {
        fontSize: 12,
        fontWeight: '700',
        color: themedColors.text,
      },
      locationQualityPill: {
        position: 'absolute',
        top: isMobile ? Math.max(insetTop, 8) + 92 : 20,
        left: isMobile ? 10 : 16,
        right: isMobile ? 10 : undefined,
        maxWidth: isMobile ? undefined : 360,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: themedColors.warningSoft,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.warning,
        zIndex: 1010,
        ...themedColors.shadows.light,
      },
      locationQualityText: {
        flex: 1,
        fontSize: 12,
        lineHeight: 15,
        fontWeight: '600',
        color: themedColors.text,
      },
      geoBanner: {
        position: 'absolute',
        // The permission state is primary mobile feedback, so keep it directly
        // below the safe-area toolbar (design states 1/3) instead of letting a
        // bottom sheet or browser footer cover it. Desktop retains the compact
        // bottom-left placement.
        top: isMobile ? Math.max(insetTop, 8) + 92 : undefined,
        bottom: isMobile ? undefined : 20,
        left: isMobile ? 10 : 16,
        right: isMobile ? 10 : undefined,
        maxWidth: isMobile ? undefined : 420,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: isMobile ? 10 : 14,
        paddingVertical: isMobile ? 7 : 9,
        backgroundColor: themedColors.warningSoft,
        borderRadius: isMobile ? 12 : 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.warning,
        zIndex: 1010,
        ...(Platform.OS === 'web'
          ? ({
              backgroundColor: themedColors.warningSoft,
              boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.05)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
            } as any)
          : themedColors.shadows.medium),
      },
      geoBannerText: {
        fontSize: isMobile ? 12 : 13,
        lineHeight: isMobile ? 15 : undefined,
        fontWeight: '500',
        color: themedColors.text,
      },
      geoBannerBody: {
        flex: 1,
        minWidth: 0,
        gap: isMobile ? 6 : 8,
      },
      geoBannerActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: isMobile ? 6 : 8,
      },
      geoBannerActionPrimary: {
        minHeight: isMobile ? 32 : 44,
        justifyContent: 'center',
        paddingHorizontal: isMobile ? 10 : 12,
        borderRadius: isMobile ? 999 : 10,
        backgroundColor: themedColors.warning,
        flexShrink: 1,
        ...webPointerCursor,
      },
      geoBannerActionPrimaryText: {
        color: themedColors.textOnPrimary,
        fontSize: isMobile ? 11 : 12,
        lineHeight: isMobile ? 13 : undefined,
        fontWeight: '700',
      },
      geoBannerActionSecondary: {
        minHeight: isMobile ? 32 : 44,
        justifyContent: 'center',
        paddingHorizontal: isMobile ? 10 : 12,
        borderRadius: isMobile ? 999 : 10,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.border,
        backgroundColor: themedColors.surface,
        flexShrink: 1,
        ...webPointerCursor,
      },
      geoBannerActionSecondaryText: {
        color: themedColors.text,
        fontSize: isMobile ? 11 : 12,
        lineHeight: isMobile ? 13 : undefined,
        fontWeight: '700',
      },
      geoBannerClose: {
        width: isMobile ? 22 : 24,
        height: isMobile ? 22 : 24,
        borderRadius: isMobile ? 11 : 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: themedColors.backgroundSecondary,
        ...(Platform.OS === 'web'
          ? ({ cursor: 'pointer' } as any)
          : null),
      },
  });
};

// Expo Router treats *.ts files under app/ as routes. Provide a harmless default export
// so the route loader stays satisfied while the styles remain importable.
export default function MapStylesPlaceholder() {
  return null;
}
