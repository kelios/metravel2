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
    },
    content: {
      flex: 1,
      flexDirection: 'row',
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      paddingTop: DESIGN_TOKENS.spacing.lg,
      paddingBottom: DESIGN_TOKENS.spacing.lg,
      overflow: 'hidden',
      width: '100%',
    },
    contentMobile: {
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingTop: 0,
      paddingBottom: DESIGN_TOKENS.spacing.sm,
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
    listContainer: {
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      paddingTop: DESIGN_TOKENS.spacing.lg,
      paddingBottom: DESIGN_TOKENS.spacing.lg,
    },
    listContainerMobile: {
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingTop: DESIGN_TOKENS.spacing.sm,
      paddingBottom: DESIGN_TOKENS.spacing.sm,
    },
    exportBar: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.md,
      padding: DESIGN_TOKENS.spacing.md,
      marginBottom: DESIGN_TOKENS.spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.medium,
        } as any,
        ios: DESIGN_TOKENS.shadowsNative.medium,
        android: { elevation: 4 },
        default: DESIGN_TOKENS.shadowsNative.medium,
      }),
    },
    exportBarMobile: {
      flexDirection: 'column',
      gap: DESIGN_TOKENS.spacing.sm,
      alignItems: 'stretch',
      padding: DESIGN_TOKENS.spacing.sm,
    },
    exportBarMobileWeb: {
      marginHorizontal: -DESIGN_TOKENS.spacing.xs,
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    exportBarInfo: {
      flex: 1,
      marginRight: DESIGN_TOKENS.spacing.md,
    },
    exportBarInfoTitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.lg,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      color: colors.text,
      marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    exportBarInfoSubtitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    exportBarInfoActions: {
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    linkButton: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.primaryText,
      textDecorationLine: 'underline',
    },
    exportBarButtons: {
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    exportBarButtonsMobile: {
      flexDirection: 'column',
      width: '100%',
      alignItems: 'stretch',
    },
    progressWrapper: {
      marginTop: DESIGN_TOKENS.spacing.sm,
    },
    recommendationsLoader: {
      marginTop: DESIGN_TOKENS.spacing.lg,
      padding: DESIGN_TOKENS.spacing.md,
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.md,
      alignItems: 'center',
    },
    recommendationsSkeleton: {
      width: '100%',
    },
    recommendationsSkeletonHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    recommendationsSkeletonTitle: {
      width: 120,
      height: 20,
      backgroundColor: colors.borderLight,
      borderRadius: DESIGN_TOKENS.radii.sm,
    },
    recommendationsSkeletonTabs: {
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    recommendationsSkeletonContent: {
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    recommendationsSkeletonCard: {
      flex: 1,
      height: 80,
      backgroundColor: colors.borderLight,
      borderRadius: DESIGN_TOKENS.radii.sm,
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
      minHeight: 720,
    },
    cardsGrid: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
    },
    resultsCount: {
      marginBottom: DESIGN_TOKENS.spacing.lg,
    },
    resultsCountText: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
      color: colors.text,
    },
    footerLoader: {
      paddingVertical: DESIGN_TOKENS.spacing.lg,
      alignItems: 'center',
    },
  })
