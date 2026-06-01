import { Platform, StyleSheet } from 'react-native'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import {
  CONTROL_RADIUS,
  PANEL_RADIUS,
  PILL_RADIUS,
  type FiltersPanelStyleContext,
} from './context'

export const getCardStyles = ({ colors, isMobile, panelWidth }: FiltersPanelStyleContext) =>
  ({
    card: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: isMobile ? 0 : PANEL_RADIUS,
      padding: isMobile ? 0 : 16,
      width: panelWidth,
      maxWidth: '100%',
      minHeight: 0,
      height:
        Platform.OS === 'web' && isMobile
          ? ('100%' as const)
          : ('100%' as const),
      maxHeight:
        Platform.OS === 'web' && isMobile
          ? ('100%' as const)
          : ('100%' as const),
      display: 'flex',
      flexDirection: 'column',
      alignSelf: isMobile ? 'stretch' : 'flex-start',
      ...(isMobile
        ? {}
        : Platform.OS === 'web'
          ? ({
              borderWidth: 1,
              borderColor: colors.borderLight,
              boxShadow: colors.boxShadows.modal,
            } as any)
          : {
              shadowColor: (colors.shadows as any)?.shadowColor ?? DESIGN_TOKENS.shadowsNative.light.shadowColor,
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.1,
              shadowRadius: 24,
              elevation: 8,
            }),
    },
    headerContainer: {
      marginBottom: 12,
    },
    stickyTop: {
      gap: isMobile ? 8 : 3,
      backgroundColor: colors.surface,
      paddingHorizontal: isMobile ? 4 : 2,
      paddingTop: isMobile ? 8 : 0,
      paddingBottom: isMobile ? 8 : 6,
      borderBottomWidth: isMobile ? StyleSheet.hairlineWidth : 0,
      borderBottomColor: isMobile ? colors.border : 'transparent',
      ...(Platform.OS === 'web'
        ? ({
            position: 'sticky',
            top: 0,
            zIndex: 5,
            backgroundColor: isMobile ? colors.surfaceAlpha40 : colors.surface,
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            paddingTop: isMobile ? 10 : 4,
          } as any)
        : null),
    },
    compactMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 4,
      minHeight: 24,
      paddingHorizontal: isMobile ? 0 : 0,
      marginBottom: 1,
    },
    compactMetaBadge: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 24,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: PILL_RADIUS,
      backgroundColor: colors.surfaceAlpha40,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    compactMetaText: {
      flex: 1,
      minWidth: 0,
      fontSize: 10,
      lineHeight: 12,
      fontWeight: '700',
      color: colors.text,
    },
    compactMetaCloseButton: {
      width: 26,
      height: 26,
      borderRadius: CONTROL_RADIUS,
      marginHorizontal: 0,
      backgroundColor: colors.surfaceAlpha40,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
      ...(Platform.OS === 'web' ? ({ boxShadow: 'none' } as any) : null),
    },
    modeSummaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: isMobile ? 2 : 0,
      paddingTop: isMobile ? 2 : 4,
    },
    modeSummaryText: {
      flex: 1,
      minWidth: 0,
      fontSize: isMobile ? 11 : 12,
      fontWeight: '700',
      color: colors.text,
    },
    modeSummaryHint: {
      fontSize: isMobile ? 10 : 11,
      lineHeight: isMobile ? 13 : 15,
      color: colors.textMuted,
      paddingHorizontal: isMobile ? 2 : 0,
      paddingBottom: isMobile ? 2 : 2,
    },
    compactTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: 0,
    },
    content: {
      flex: 1,
      flexGrow: 1,
      minHeight: 0,
      ...(Platform.OS === 'web'
        ? ({
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          } as any)
        : null),
    },
  }) as const
