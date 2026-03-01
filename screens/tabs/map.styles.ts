// src/screens/tabs/map.styles.ts
import { Platform, StyleSheet } from 'react-native';
import { LAYOUT, METRICS } from '@/constants/layout';
import type { ThemedColors } from '@/hooks/useTheme';

// ✅ Токенизация: базируемся на 8pt-системе METRICS
const PANEL_WIDTH_DESKTOP = METRICS.baseUnit * 48; // 384px
const PANEL_WIDTH_TABLET = METRICS.baseUnit * 42; // 336px
const PANEL_GAP = METRICS.spacing.m; // 16px
const TRANSITION_MS = 180;
const WEB_MOBILE_FOOTER_RESERVE_HEIGHT = LAYOUT?.tabBarHeight ?? 56;

export const getStyles = (
  isMobile: boolean,
  insetTop: number,
  _headerOffset: number, // Префикс _ для неиспользуемого параметра
  _windowWidth: number = METRICS.breakpoints.tablet,
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
            // row-reverse: панель слева, карта справа
            flexDirection: isMobile ? 'column' : 'row-reverse',
            columnGap: isMobile ? 0 : PANEL_GAP,
            paddingLeft: isMobile ? 0 : METRICS.spacing.l,
            paddingRight: 0,
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
      content: {
        flex: 1,
        position: 'relative',
        backgroundColor: themedColors.background,
        // ✅ КРИТИЧНО: Создаем новый stacking context для изоляции карты от хедера
        ...(Platform.OS === 'web'
          ? ({
              flexDirection: isMobile ? 'column' : 'row',
              columnGap: isMobile ? 0 : PANEL_GAP,
              paddingHorizontal: isMobile ? 0 : METRICS.spacing.l,
              isolation: 'isolate',
            } as any)
          : null),
      },
      mapArea: {
        flex: 1,
        minHeight: isMobile ? 260 : 500,
        position: 'relative',
        // ✅ КРИТИЧНО: Очень низкий zIndex, чтобы гарантировать, что карта под хедером
        zIndex: 0,
        // Дополнительная изоляция для Leaflet
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
      togglePanelButton: {
        position: 'absolute',
        right: 16,
        ...(isMobile
          ? ({
              // On mobile we control the panel via HeaderContextBar + bottom sheet.
              // This legacy floating toggle button overlaps the sheet.
              display: 'none',
              pointerEvents: 'none',
            } as any)
          : null),
        ...(isMobile
          ? ({
              bottom: Platform.OS === 'web' ? 16 + WEB_MOBILE_FOOTER_RESERVE_HEIGHT : 16,
            } as any)
          : ({
              top: 16,
            } as any)),
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: themedColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        ...(Platform.OS === 'web'
          ? ({
              // @ts-ignore: web-only style
              boxShadow: themedColors.boxShadows.medium,
            } as any)
          : Platform.OS === 'ios'
          ? shadowMedium
          : ({ elevation: shadowMedium.elevation } as any)),
        zIndex: 1001,
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
              boxShadow: isMobile ? themedColors.boxShadows.heavy : 'none',
              borderTopLeftRadius: isMobile ? 24 : 0,
              borderBottomLeftRadius: isMobile ? 0 : 0,
              borderTopRightRadius: isMobile ? 24 : 0,
              borderLeftWidth: isMobile ? 0 : StyleSheet.hairlineWidth,
              borderLeftColor: isMobile ? undefined : themedColors.border,
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
      rightPanelMobileOpen: {
        transform: [{ translateY: 0 }],
        opacity: 1,
        pointerEvents: 'auto',
      },
      rightPanelMobileClosed: {
        transform: [{ translateY: '100%' }],
        opacity: 0,
        pointerEvents: 'none',
      },
      rightPanelDesktopClosed: {
        width: 0,
        minWidth: 0,
        maxWidth: 0,
        opacity: 0,
        pointerEvents: 'none',
        transform: [{ translateX: 16 }],
      },
      overlay: {
        position: 'absolute',
        // ✅ ИСПРАВЛЕНИЕ: Убран effectiveHeaderOffset, так как хедер уже в потоке
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
      overlayHidden: {
        opacity: 0,
        pointerEvents: 'none',
      },
      overlayVisible: {
        opacity: 1,
        pointerEvents: 'auto',
      },
      dragHandle: {
        position: 'absolute',
        top: 8,
        left: '50%',
        marginLeft: -20,
        width: 40,
        height: 4,
        backgroundColor: themedColors.border,
        borderRadius: 2,
        opacity: 0.6,
      },
      tabsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: isMobile ? Math.max(14, insetTop + 4) : 10,
        paddingBottom: isMobile ? 10 : 10,
        paddingHorizontal: isMobile ? 14 : 10,
        backgroundColor: themedColors.surface,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: themedColors.border,
        columnGap: isMobile ? 6 : 8,
        minHeight: isMobile ? 54 : undefined,
      },
      tabsSegment: {
        flexDirection: 'row',
        backgroundColor: themedColors.surfaceLight,
        borderRadius: 12,
        padding: 3,
        columnGap: 2,
        alignSelf: isMobile ? 'flex-start' : 'stretch',
        flex: isMobile ? 0 : 1,
      },
      tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: isMobile ? 8 : 8,
        paddingHorizontal: isMobile ? 14 : 10,
        borderRadius: 10,
        gap: isMobile ? 0 : 8,
        minWidth: isMobile ? 48 : undefined,
        minHeight: isMobile ? 40 : undefined,
      },
      tabActive: {
        backgroundColor: themedColors.primary,
      },
      tabPressed: {
        opacity: 0.88,
      },
      tabIconBubble: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: themedColors.surfaceLight,
      },
      tabIconBubbleActive: {
        backgroundColor: themedColors.primaryLight,
      },
      tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: themedColors.text,
      },
      tabTextActive: {
        color: themedColors.textInverse,
      },
      panelContent: {
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: themedColors.surface,
      },
      resetButton: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: themedColors.surfaceLight,
        ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
      },
      resetButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: themedColors.textMuted,
      },
      closePanelButton: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: themedColors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
      },
      travelsListContainer: {
        flex: 1,
        padding: 12,
      },
      loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      },
      loaderText: {
        marginTop: 8,
        color: themedColors.textMuted,
        fontSize: 14,
      },
      updatingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: themedColors.primarySoft,
        borderRadius: 8,
        marginBottom: 8,
      },
      updatingText: {
        marginLeft: 8,
        color: themedColors.text,
        fontSize: 12,
        fontWeight: '600',
      },
      mapPlaceholder: {
        flex: 1,
        minHeight: 260,
        borderRadius: 20,
        backgroundColor: themedColors.surface,
        marginLeft: Platform.OS === 'web' ? 16 : 0,
        marginRight: Platform.OS === 'web' ? 16 : 0,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.border,
      },
      mapPlaceholderText: {
        marginTop: 8,
        fontSize: 14,
        color: themedColors.textMuted,
      },
      errorContainer: {
        flex: 1,
        padding: 16,
        justifyContent: 'center',
      },
      fab: {
        position: 'absolute',
        right: 16,
        bottom: 16,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: themedColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1001,
        ...(Platform.OS === 'web'
          ? ({ boxShadow: themedColors.boxShadows.medium } as any)
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
        backgroundColor: themedColors.surfaceLight,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        paddingHorizontal: 6,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 6,
      },
      badgeActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
      },
      badgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: themedColors.text,
      },
      badgeTextActive: {
        color: themedColors.textInverse,
      },
      collapsedPanel: {
        width: 44,
        flexShrink: 0,
        alignItems: 'center',
        paddingTop: 12,
        gap: 10,
        backgroundColor: themedColors.surface,
        borderLeftWidth: StyleSheet.hairlineWidth,
        borderLeftColor: themedColors.border,
      },
      collapseToggle: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: themedColors.surfaceLight,
        ...(Platform.OS === 'web'
          ? ({ cursor: 'pointer' } as any)
          : null),
      },
      collapseToggleInPanel: {
        position: 'absolute',
        top: 10,
        left: -14,
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: themedColors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.border,
        zIndex: 1002,
        ...(Platform.OS === 'web'
          ? ({
              cursor: 'pointer',
              boxShadow: themedColors.boxShadows.light,
            } as any)
          : null),
      },
      collapsedIconBtn: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        ...(Platform.OS === 'web'
          ? ({ cursor: 'pointer' } as any)
          : null),
      },
      collapsedBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: themedColors.primary,
        borderRadius: 8,
        minWidth: 16,
        height: 16,
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
      },
      collapsedBadgeText: {
        fontSize: 9,
        fontWeight: '700',
        color: themedColors.textOnPrimary,
      },
      resizeHandle: {
        position: 'absolute',
        left: -4,
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
        bottom: isMobile && Platform.OS === 'web' ? WEB_MOBILE_FOOTER_RESERVE_HEIGHT + 12 : 16,
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: themedColors.surface,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: themedColors.warningLight,
        zIndex: 1010,
        ...(Platform.OS === 'web'
          ? ({ boxShadow: themedColors.boxShadows.medium } as any)
          : themedColors.shadows.medium),
      },
      geoBannerText: {
        flex: 1,
        fontSize: 13,
        color: themedColors.text,
      },
      geoBannerClose: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: themedColors.surfaceLight,
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
