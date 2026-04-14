import { Platform, StyleSheet } from 'react-native'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { LAYOUT } from '@/constants/layout'
import { useThemedColors } from '@/hooks/useTheme'

export const createListTravelBaseStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      display: 'flex',
      flexDirection: 'row',
      overflowX: 'hidden',
      width: '100%',
      maxWidth: '100%',
      ...Platform.select({
        web: {
          minHeight: 900,
        },
      }),
    },
    rootMobile: {
      flexDirection: 'column',
      ...(Platform.OS === 'web' ? ({ minHeight: 0 } as any) : null),
    },
    sidebar: {
      width: 320,
      flexShrink: 0,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      paddingTop: DESIGN_TOKENS.spacing.lg,
      overflowY: 'auto',
      overflowX: 'hidden',
      ...(Platform.OS === 'web' ? ({ scrollbarGutter: 'stable' } as any) : null),
    },
    sidebarMobile: {
      width: '100%',
      borderRightWidth: 0,
      borderBottomWidth: 1,
      ...(Platform.OS === 'web'
        ? ({
            position: 'fixed' as any,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9000,
            maxHeight: '100vh',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            borderBottomWidth: 0,
            animationKeyframes: 'sheet-slide-up',
            animationDuration: '0.32s',
            animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
          } as any)
        : {}),
    },
    rightColumn: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      height: '100%',
      ...Platform.select({
        web: {
          minHeight: 900,
        },
      }),
      ...(Platform.OS === 'web' ? ({ paddingTop: DESIGN_TOKENS.spacing.lg } as const) : null),
    },
    rightColumnMobile: {
      width: '100%',
      paddingTop: 0,
      ...(Platform.OS === 'web' ? ({ minHeight: 0, height: 'auto' } as any) : null),
    },
    searchHeader: {
      position: 'relative',
      zIndex: 10,
      backgroundColor: colors.surface,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
        } as any,
        ios: DESIGN_TOKENS.shadowsNative.light,
        android: { elevation: 2 },
        default: DESIGN_TOKENS.shadowsNative.light,
      }),
    },
    cardsContainer: {
      flex: 1,
      overflowY: 'auto',
      overflowX: 'hidden',
      ...(Platform.OS === 'web' ? ({ scrollbarGutter: 'stable' } as any) : null),
      paddingTop: DESIGN_TOKENS.spacing.md,
      paddingBottom: DESIGN_TOKENS.spacing.md,
      ...Platform.select({
        web: {
          minHeight: 900,
        },
      }),
    },
    cardsContainerMobile: {
      paddingBottom: (LAYOUT?.tabBarHeight ?? 56) + DESIGN_TOKENS.spacing.xl,
      ...(Platform.OS === 'web' ? ({ minHeight: 0 } as any) : null),
    },
    cardsGrid: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
    },
    footerLoader: {
      paddingVertical: DESIGN_TOKENS.spacing.lg,
      alignItems: 'center',
    },
  })
