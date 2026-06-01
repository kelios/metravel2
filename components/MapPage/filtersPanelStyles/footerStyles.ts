import { Platform, StyleSheet } from 'react-native'
import { CONTROL_RADIUS, type FiltersPanelStyleContext } from './context'

export const getFooterStyles = ({ colors, isMobile, bottomDockReserve }: FiltersPanelStyleContext) =>
  ({
    stickyFooter: {
      ...(Platform.OS === 'web'
        ? isMobile
          ? ({
              position: 'sticky',
              bottom: 0,
              zIndex: 4,
              backgroundColor: colors.surface,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              paddingTop: 8,
              paddingBottom: 8,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.borderLight,
            } as any)
          : ({
              position: 'sticky',
              bottom: bottomDockReserve,
              backgroundColor: colors.surfaceAlpha40,
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              paddingTop: 4,
              paddingBottom: 4,
            } as any)
        : {
            paddingTop: isMobile ? 8 : 4,
            paddingBottom: isMobile ? 8 : 0,
            backgroundColor: colors.surface,
            borderTopWidth: isMobile ? StyleSheet.hairlineWidth : 0,
            borderTopColor: isMobile ? colors.borderLight : 'transparent',
          }),
    },
    footerButtons: {
      flexDirection: 'row',
      gap: isMobile ? 8 : 10,
      justifyContent: 'flex-end',
      alignItems: 'stretch',
      paddingHorizontal: isMobile ? 10 : 0,
      paddingBottom: 0,
    },
    mobileFooterSummary: {
      paddingHorizontal: isMobile ? 8 : 0,
      paddingBottom: 6,
      gap: 2,
    },
    mobileFooterSummaryTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.text,
    },
    mobileFooterSummaryHint: {
      fontSize: 10,
      lineHeight: 14,
      color: colors.textMuted,
    },
    ctaButton: {
      borderRadius: CONTROL_RADIUS,
      paddingHorizontal: isMobile ? 14 : 12,
      paddingVertical: isMobile ? 9 : 8,
      minHeight: isMobile ? 42 : 40,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    ctaPrimary: {
      minHeight: isMobile ? 42 : 48,
      paddingVertical: isMobile ? 9 : 12,
      paddingHorizontal: isMobile ? 14 : 18,
      borderRadius: CONTROL_RADIUS,
      flex: 1,
      gap: 6,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: colors.boxShadows.hover,
            transition: 'background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
          } as any)
        : {
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 6,
          }),
    },
    ctaPrimaryDisabled: {
      backgroundColor: colors.backgroundSecondary,
      borderColor: colors.borderLight,
      borderWidth: 1,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: 'none',
          } as any)
        : {
            shadowOpacity: 0,
            elevation: 0,
          }),
    },
    helperText: {
      fontSize: 10,
      color: colors.textMuted,
      marginBottom: 3,
    },
  }) as const
