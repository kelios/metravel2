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

  return StyleSheet.create({
    container: {
      flex: 1,
      ...(Platform.OS === 'web'
        ? ({
            height: `calc(100dvh - ${WEB_HEADER_RESERVED_HEIGHT}px)`,
            maxHeight: `calc(100dvh - ${WEB_HEADER_RESERVED_HEIGHT}px)`,
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
            backgroundColor: isMobile ? themedColors.background : themedColors.backgroundSecondary,
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
              backdropFilter: 'blur(20px) saturate(1.05)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.05)',
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
              backgroundColor: isMobile ? themedColors.surfaceAlpha40 : themedColors.surface,
              backdropFilter: 'blur(20px) saturate(1.05)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.05)',
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
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.borderLight,
      },
      tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: isMobile ? 7 : 9,
        paddingHorizontal: isMobile ? 12 : 10,
        borderRadius: 11,
        gap: 6,
        minWidth: isMobile ? 48 : undefined,
        minHeight: isMobile ? 34 : 36,
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
        width: CONTROL_SIZE,
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
        minWidth: 20,
        height: 18,
        paddingHorizontal: 5,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 4,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.borderLight,
      },
      badgeActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.28)',
        borderColor: 'rgba(255,255,255,0.2)',
      },
      badgeText: {
        fontSize: 10,
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
        right: -16,
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
            } as any)
          : themedColors.shadows.light),
      },
      radiusPillText: {
        fontSize: 12,
        fontWeight: '700',
        color: themedColors.text,
      },
      geoBanner: {
        position: 'absolute',
        bottom: isMobile && Platform.OS === 'web' ? WEB_MOBILE_FOOTER_RESERVE_HEIGHT + 16 : 20,
        left: 16,
        right: isMobile ? 16 : undefined,
        maxWidth: isMobile ? undefined : 280,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 9,
        backgroundColor: themedColors.surface,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.warningSoft,
        zIndex: 1010,
        ...(Platform.OS === 'web'
          ? ({
              backgroundColor: themedColors.surfaceAlpha40,
              boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.05)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
            } as any)
          : themedColors.shadows.medium),
      },
      geoBannerText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
        color: themedColors.text,
      },
      geoBannerClose: {
        width: 24,
        height: 24,
        borderRadius: 12,
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
