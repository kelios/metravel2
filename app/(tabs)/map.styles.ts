import { Platform, StyleSheet } from 'react-native';
import { METRICS } from '@/constants/layout';
import type { ThemedColors } from '@/hooks/useTheme';

// ✅ Токенизация: базируемся на 8pt-системе METRICS
const PANEL_WIDTH_DESKTOP = METRICS.baseUnit * 48; // 384px
const PANEL_WIDTH_TABLET = METRICS.baseUnit * 42; // 336px
const PANEL_GAP = METRICS.spacing.m; // 16px
const TRANSITION_MS = 180;
const WEB_MOBILE_FOOTER_RESERVE_HEIGHT = 56;

export const getStyles = (
  isMobile: boolean,
  insetTop: number,
  _headerOffset: number, // Префикс _ для неиспользуемого параметра
  windowWidth: number = METRICS.breakpoints.tablet,
  themedColors: ThemedColors,
) => {
  const panelSlideDistance = Math.max(windowWidth, PANEL_WIDTH_TABLET);
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
            paddingBottom: isMobile ? WEB_MOBILE_FOOTER_RESERVE_HEIGHT : 0,
          } as any)
        : null),
      backgroundColor: themedColors.background,
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
              // transform создает новый stacking context
              transform: 'translateZ(0)',
            } as any)
          : null),
      },
      mapArea: {
        flex: 1,
        minHeight: 260,
        position: 'relative',
        // ✅ КРИТИЧНО: Очень низкий zIndex, чтобы гарантировать, что карта под хедером
        zIndex: 0,
        // Дополнительная изоляция для Leaflet
        ...(Platform.OS === 'web'
          ? ({
              isolation: 'isolate',
              transform: 'translateZ(0)',
            } as any)
          : null),
      },
      togglePanelButton: {
        position: 'absolute',
        right: 16,
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
        ...Platform.select({
          web: {
            // @ts-ignore: web-only style
            boxShadow: themedColors.boxShadows.medium,
          },
          ios: {
            ...shadowMedium,
          },
          android: {
            elevation: shadowMedium.elevation,
          },
          default: {
            ...shadowMedium,
          },
        }),
        zIndex: 1001,
      },
      rightPanel: {
        position: isMobile ? 'absolute' : 'relative',
        right: isMobile ? 0 : undefined,
        // ✅ ИСПРАВЛЕНИЕ: Убран effectiveHeaderOffset, так как хедер уже в потоке
        top: 0,
        bottom: isMobile ? (Platform.OS === 'web' ? WEB_MOBILE_FOOTER_RESERVE_HEIGHT : 0) : undefined,
        width: isMobile ? '100%' : PANEL_WIDTH_DESKTOP,
        maxWidth: isMobile ? '100%' : PANEL_WIDTH_DESKTOP + 40,
        backgroundColor: themedColors.surface,
        ...(Platform.OS === 'web'
          ? ({
              boxShadow: themedColors.boxShadows.modal,
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
              transition: `transform ${TRANSITION_MS}ms ease, opacity ${TRANSITION_MS}ms ease`,
            } as any)
          : null),
      },
      rightPanelMobileOpen: {
        transform: [{ translateX: 0 }],
        opacity: 1,
        pointerEvents: 'auto',
      },
      rightPanelMobileClosed: {
        transform: [{ translateX: panelSlideDistance }],
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
      tabsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        // ✅ ИСПРАВЛЕНИЕ: Убран effectiveHeaderOffset из paddingTop
        paddingTop: isMobile ? insetTop + 6 : 8,
        paddingBottom: 10,
        paddingHorizontal: isMobile ? 12 : 8,
        backgroundColor: themedColors.surface,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: themedColors.border,
        columnGap: 8,
        ...(Platform.OS === 'web'
          ? ({
              boxShadow: isMobile ? themedColors.boxShadows.medium : themedColors.boxShadows.light,
            } as any)
          : Platform.OS === 'ios'
          ? (isMobile ? shadowMedium : shadowLight)
          : { elevation: isMobile ? shadowMedium.elevation : shadowLight.elevation }),
        zIndex: 1001,
      },
      tabsSegment: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: themedColors.surfaceLight,
        borderRadius: 16,
        padding: 4,
        columnGap: 6,
      },
      tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 12,
        gap: 10,
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
  });
};

// Expo Router treats *.ts files under app/ as routes. Provide a harmless default export
// so the route loader stays satisfied while the styles remain importable.
export default function MapStylesPlaceholder() {
  return null;
}
