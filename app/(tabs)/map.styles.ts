import { Platform, StyleSheet } from 'react-native';
import { METRICS } from '@/constants/layout';

// ✅ Токенизация: базируемся на 8pt-системе METRICS
const PANEL_WIDTH_DESKTOP = METRICS.baseUnit * 48; // 384px
const PANEL_WIDTH_TABLET = METRICS.baseUnit * 42; // 336px
const PANEL_GAP = METRICS.spacing.m; // 16px
const OVERLAY_COLOR = 'rgba(0, 0, 0, 0.5)';
const TRANSITION_MS = 180;

export const getStyles = (isMobile: boolean, insetTop: number, headerOffset: number) => {
  const effectiveHeaderOffset = Platform.OS === 'web' ? 0 : headerOffset;
  return StyleSheet.create({
    // На web шапка уже занимает поток, поэтому смещение не требуется
    // На native (если появится) оставляем headerOffset
    container: {
      flex: 1,
      ...(Platform.OS === 'web'
        ? ({
            minHeight: 0,
          } as any)
        : null),
      backgroundColor: '#f5f5f5',
      paddingTop: effectiveHeaderOffset,
    },
      content: {
        flex: 1,
        position: 'relative',
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
        backgroundColor: '#4a8c8c',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
        zIndex: 1001,
      },
      rightPanel: {
        position: isMobile ? 'absolute' : 'relative',
        right: isMobile ? 0 : undefined,
        top: isMobile ? effectiveHeaderOffset : 0,
        bottom: isMobile ? 0 : undefined,
        width: isMobile ? '100%' : PANEL_WIDTH_DESKTOP,
        maxWidth: isMobile ? '100%' : PANEL_WIDTH_DESKTOP + 40,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: -2, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
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
        transform: [{ translateX: 400 }],
        opacity: 0,
        pointerEvents: 'none',
      },
      overlay: {
        position: 'absolute',
        top: effectiveHeaderOffset,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: OVERLAY_COLOR,
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
        backgroundColor: '#fff',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#e2e8f0',
        columnGap: 8,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isMobile ? 0.08 : 0.05,
        shadowRadius: 8,
        elevation: isMobile ? 5 : 2,
        zIndex: 1001,
      },
      tabsSegment: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
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
        backgroundColor: '#4a8c8c',
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
        backgroundColor: '#e2e8f0',
      },
      tabIconBubbleActive: {
        backgroundColor: 'rgba(255,255,255,0.18)',
      },
      tabLabelColumn: {
        flex: 1,
      },
      tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1f2933',
      },
      tabTextActive: {
        color: '#fff',
      },
      tabHint: {
        fontSize: 12,
        fontWeight: '500',
        color: '#64748b',
      },
      tabHintActive: {
        color: 'rgba(255,255,255,0.85)',
      },
      panelContent: {
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#fff',
      },
      closePanelButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#eef2f6',
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
        color: '#666',
        fontSize: 14,
      },
      updatingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#f0f7ff',
        borderRadius: 8,
        marginBottom: 8,
      },
      updatingText: {
        marginLeft: 8,
        color: '#4a8c8c',
        fontSize: 12,
        fontWeight: '500',
      },
      mapPlaceholder: {
        flex: 1,
        minHeight: 260,
        borderRadius: 20,
        backgroundColor: '#fff',
        marginLeft: Platform.OS === 'web' ? 16 : 0,
        marginRight: Platform.OS === 'web' ? 16 : 0,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#e2e8f0',
      },
      mapPlaceholderText: {
        marginTop: 8,
        fontSize: 14,
        color: '#8c99a6',
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
