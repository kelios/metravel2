// src/screens/tabs/map.styles.ts
import { Platform, StyleSheet } from 'react-native';
import { LAYOUT, METRICS } from '@/constants/layout';
import type { ThemedColors } from '@/hooks/useTheme';

// ✅ Токенизация: базируемся на 8pt-системе METRICS
const PANEL_WIDTH_DESKTOP = METRICS.baseUnit * 48; // 384px
const PANEL_WIDTH_TABLET = METRICS.baseUnit * 42; // 336px
const PANEL_GAP = METRICS.spacing.m; // 16px
const TRANSITION_MS = 200;
const WEB_MOBILE_FOOTER_RESERVE_HEIGHT = LAYOUT?.tabBarHeight ?? 56;

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
            paddingLeft: 0,
            paddingRight: isMobile ? 0 : METRICS.spacing.l,
            paddingTop: 0,
            paddingBottom: 0,
            height: '100%',
            minHeight: 0,
            minWidth: 0,
            alignItems: 'stretch',
            isolation: 'isolate',
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
        backgroundColor: themedColors.surface,
        minHeight: 0,
        minWidth: 0,
        flexShrink: 0,
        ...(Platform.OS === 'web'
          ? ({
              boxShadow: isMobile
                ? themedColors.boxShadows.heavy
                : '0 14px 36px rgba(15,23,42,0.08), 0 2px 10px rgba(15,23,42,0.05)',
              borderTopLeftRadius: isMobile ? 20 : 24,
              borderTopRightRadius: isMobile ? 20 : 24,
              borderBottomLeftRadius: isMobile ? 0 : 24,
              overflow: 'hidden',
              borderRightWidth: 0,
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
        paddingTop: isMobile ? Math.max(10, insetTop + 2) : 7,
        paddingBottom: isMobile ? 7 : 7,
        paddingHorizontal: isMobile ? 10 : 10,
        backgroundColor: themedColors.surface,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: themedColors.borderLight,
        columnGap: 8,
        minHeight: isMobile ? 46 : undefined,
        ...(Platform.OS === 'web'
          ? ({ boxShadow: '0 1px 0 rgba(15,23,42,0.05)' } as any)
          : null),
      },
      tabsSegment: {
        flexDirection: 'row',
        backgroundColor: themedColors.backgroundSecondary,
        borderRadius: 12,
        padding: 2,
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
        paddingVertical: 6,
        paddingHorizontal: isMobile ? 12 : 10,
        borderRadius: 10,
        gap: isMobile ? 0 : 6,
        minWidth: isMobile ? 48 : undefined,
        minHeight: isMobile ? 34 : undefined,
      },
      tabActive: {
        backgroundColor: themedColors.primary,
        ...(Platform.OS === 'web'
          ? ({ boxShadow: `0 1px 6px ${themedColors.primary}30` } as any)
          : null),
      },
      tabIconBubble: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: themedColors.surfaceLight,
      },
      tabIconBubbleActive: {
        backgroundColor: themedColors.primaryLight,
      },
      tabText: {
        fontSize: 12,
        fontWeight: '600',
        color: themedColors.textMuted,
        letterSpacing: 0.1,
      },
      tabTextActive: {
        color: themedColors.textOnPrimary,
      },
      panelContent: {
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: themedColors.surface,
      },
      resetButton: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: themedColors.backgroundSecondary,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.borderLight,
        ...(Platform.OS === 'web' ? ({
          cursor: 'pointer',
          transition: 'background-color 0.15s ease',
        } as any) : null),
      },
      closePanelButton: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: themedColors.backgroundSecondary,
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
        borderRadius: 9,
        minWidth: 18,
        height: 16,
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 3,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.borderLight,
      },
      badgeActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        borderColor: 'transparent',
      },
      badgeText: {
        fontSize: 9,
        fontWeight: '700',
        color: themedColors.textMuted,
      },
      badgeTextActive: {
        color: themedColors.textOnPrimary,
      },
      collapsedPanel: {
        width: 48,
        flexShrink: 0,
        alignItems: 'center',
        paddingTop: 12,
        gap: 10,
        backgroundColor: themedColors.surface,
        borderRightWidth: StyleSheet.hairlineWidth,
        borderRightColor: themedColors.borderLight,
        ...(Platform.OS === 'web'
          ? ({ boxShadow: '1px 0 0 rgba(0,0,0,0.05)' } as any)
          : null),
      },
      collapseToggle: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: themedColors.backgroundSecondary,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.borderLight,
        ...(Platform.OS === 'web'
          ? ({ cursor: 'pointer', transition: 'background-color 0.15s ease' } as any)
          : null),
      },
      collapseToggleInPanel: {
        position: 'absolute',
        top: 12,
        right: -14,
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: themedColors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.borderLight,
        zIndex: 1002,
        ...(Platform.OS === 'web'
          ? ({
              cursor: 'pointer',
              boxShadow: '0 1px 6px rgba(0,0,0,0.10)',
              transition: 'background-color 0.15s ease',
            } as any)
          : null),
      },
      collapsedIconBtn: {
        width: 40,
        height: 40,
        borderRadius: 10,
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
        right: -4,
        top: 0,
        bottom: 0,
        width: 8,
        zIndex: 1003,
        ...(Platform.OS === 'web'
          ? ({ cursor: 'col-resize' } as any)
          : null),
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
        paddingVertical: 10,
        backgroundColor: themedColors.surface,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.warningSoft,
        zIndex: 1010,
        ...(Platform.OS === 'web'
          ? ({
              boxShadow: '0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.05)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
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
