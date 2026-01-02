import { Platform, StyleSheet } from 'react-native';
import { METRICS } from '@/constants/layout';
import type { ThemedColors } from '@/hooks/useTheme';

// ✅ Токенизация: базируемся на 8pt-системе METRICS
const PANEL_WIDTH_DESKTOP = METRICS.baseUnit * 48; // 384px
const PANEL_WIDTH_TABLET = METRICS.baseUnit * 42; // 336px
const PANEL_GAP = METRICS.spacing.m; // 16px
const TRANSITION_MS = 180;

export const getStyles = (
  isMobile: boolean,
  insetTop: number,
  headerOffset: number,
  windowWidth: number = METRICS.breakpoints.tablet,
  themedColors: ThemedColors,
) => {
  // Учитываем высоту web-хедера, иначе карта “подпрыгивает” под него и шапка пропадает
  const effectiveHeaderOffset = headerOffset;
  const panelSlideDistance = Math.max(windowWidth, PANEL_WIDTH_TABLET);
  const shadowLight = themedColors.shadows.light;
  const shadowMedium = themedColors.shadows.medium;
  const shadowHeavy = themedColors.shadows.heavy;
  return StyleSheet.create({
    // На web шапка уже занимает поток, поэтому смещение не требуется
    // На native (если появится) оставляем headerOffset
    container: {
      flex: 1,
      // Заполняем экран и окрашиваем фон на web, чтобы не просвечивал белый фон body
      ...(Platform.OS === 'web'
        ? ({
            minHeight: '100vh',
          } as any)
        : null),
      backgroundColor: themedColors.background,
      paddingTop: effectiveHeaderOffset,
    },
      content: {
        flex: 1,
        position: 'relative',
        backgroundColor: themedColors.background,
        ...(Platform.OS === 'web'
          ? ({
              flexDirection: isMobile ? 'column' : 'row',
              columnGap: isMobile ? 0 : PANEL_GAP,
              paddingHorizontal: isMobile ? 0 : METRICS.spacing.l,
            } as any)
          : null),
      },
      mapArea: {
        flex: 1,
        minHeight: 260,
      },
      togglePanelButton: {
        position: 'absolute',
        right: 16,
        ...(isMobile
          ? ({
              bottom: 16,
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
        top: isMobile ? effectiveHeaderOffset : 0,
        bottom: isMobile ? 0 : undefined,
        width: isMobile ? '100%' : PANEL_WIDTH_DESKTOP,
        maxWidth: isMobile ? '100%' : PANEL_WIDTH_DESKTOP + 40,
        backgroundColor: themedColors.surface,
        ...Platform.select({
          web: {
            // @ts-ignore: web-only style
            boxShadow: themedColors.boxShadows.modal,
          },
          ios: {
            ...shadowHeavy,
          },
          android: {
            elevation: shadowHeavy.elevation,
          },
          default: {
            ...shadowHeavy,
          },
        }),
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
        top: effectiveHeaderOffset,
        left: 0,
        right: 0,
        bottom: 0,
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
        paddingTop: (isMobile ? insetTop + 6 : 8) + effectiveHeaderOffset,
        paddingBottom: 10,
        paddingHorizontal: isMobile ? 12 : 8,
        backgroundColor: themedColors.surface,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: themedColors.border,
        columnGap: 8,
        ...Platform.select({
          web: {
            // @ts-ignore: web-only style
            boxShadow: isMobile ? themedColors.boxShadows.medium : themedColors.boxShadows.light,
          },
          ios: {
            ...(isMobile ? shadowMedium : shadowLight),
          },
          android: {
            elevation: isMobile ? shadowMedium.elevation : shadowLight.elevation,
          },
          default: {
            ...(isMobile ? shadowMedium : shadowLight),
          },
        }),
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
