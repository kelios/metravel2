// src/screens/tabs/map.styles.ts
import { Platform, StyleSheet } from 'react-native';
import { LAYOUT, METRICS } from '@/constants/layout';
import type { ThemedColors } from '@/hooks/useTheme';

// ✅ Токенизация: базируемся на 8pt-системе METRICS
const PANEL_WIDTH_DESKTOP = METRICS.baseUnit * 48; // 384px
const PANEL_WIDTH_TABLET = METRICS.baseUnit * 42; // 336px
const PANEL_GAP = METRICS.spacing.m; // 16px
const TRANSITION_MS = 180;
const WEB_MOBILE_FOOTER_RESERVE_HEIGHT = LAYOUT.tabBarHeight;

export const getStyles = (
  isMobile: boolean,
  insetTop: number,
  _headerOffset: number, // Префикс _ для неиспользуемого параметра
  _windowWidth: number = METRICS.breakpoints.tablet,
  themedColors: ThemedColors,
) => {
  const shadowLight = themedColors.shadows.light;
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
              minHeight: 0,
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
              boxShadow: themedColors.boxShadows.heavy,
              borderTopLeftRadius: isMobile ? 20 : 0,
              borderTopRightRadius: isMobile ? 20 : 0,
            } as any)
          : Platform.OS === 'ios'
          ? shadowHeavy
          : { elevation: shadowHeavy.elevation }),
        zIndex: 1000,
        ...(Platform.OS === 'web' && !isMobile
          ? ({
              width: `min(${PANEL_WIDTH_DESKTOP}px, 35vw)`,
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
        paddingTop: isMobile ? Math.max(16, insetTop + 6) : 8,
        paddingBottom: isMobile ? 8 : 10,
        paddingHorizontal: isMobile ? 16 : 8,
        backgroundColor: themedColors.surface,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: themedColors.border,
        columnGap: isMobile ? 6 : 8,
        minHeight: isMobile ? 56 : undefined,
        ...(Platform.OS === 'web'
          ? ({
              boxShadow: isMobile ? themedColors.boxShadows.light : themedColors.boxShadows.light,
            } as any)
          : Platform.OS === 'ios'
          ? shadowLight
          : { elevation: shadowLight.elevation }),
        zIndex: 1001,
      },
      tabsSegment: {
        flexDirection: 'row',
        backgroundColor: themedColors.surfaceLight,
        borderRadius: isMobile ? 12 : 16,
        padding: 4,
        columnGap: isMobile ? 4 : 6,
        alignSelf: isMobile ? 'flex-start' : 'stretch',
        flex: isMobile ? 0 : 1,
        marginLeft: isMobile ? 0 : undefined,
      },
      tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: isMobile ? 10 : 10,
        paddingHorizontal: isMobile ? 12 : 10,
        borderRadius: 12,
        gap: isMobile ? 0 : 10,
        minWidth: isMobile ? 52 : undefined,
        minHeight: isMobile ? 44 : undefined,
      },
      tabActive: {
        backgroundColor: themedColors.primary,
      },
      tabPressed: {
        opacity: 0.92,
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
      tabLabelColumn: {
        flex: 1,
      },
      tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: themedColors.text,
      },
      tabTextActive: {
        color: themedColors.textInverse,
      },
      tabHint: {
        fontSize: 12,
        fontWeight: '500',
        color: themedColors.textMuted,
      },
      tabHintActive: {
        color: themedColors.textInverse,
      },
      panelContent: {
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: themedColors.surface,
      },
      closePanelButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: themedColors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
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
  });
};

// Expo Router treats *.ts files under app/ as routes. Provide a harmless default export
// so the route loader stays satisfied while the styles remain importable.
export default function MapStylesPlaceholder() {
  return null;
}
