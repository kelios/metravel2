import { Platform, StyleSheet } from 'react-native'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { LAYOUT } from '@/constants/layout'
import { useThemedColors } from '@/hooks/useTheme'

export const createListTravelBaseStyles = (colors: ReturnType<typeof useThemedColors>, sidebarWidth = 320) =>
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
          // The route already lives inside the root flex column between the
          // global header and footer. A fixed 900px minimum made the catalog
          // overflow that slot on laptop/tablet heights and put cards behind
          // the footer instead of letting the internal FlashList own scrolling.
          minHeight: 0,
        },
      }),
    },
    rootMobile: {
      flexDirection: 'column',
      ...(Platform.OS === 'web' ? ({ minHeight: 0 } as any) : null),
    },
    sidebar: {
      width: sidebarWidth,
      flexShrink: 0,
      borderRightWidth: 1,
      borderRightColor: colors.borderLight,
      backgroundColor: colors.background,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingTop: DESIGN_TOKENS.spacing.md,
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
          minHeight: 0,
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
      backgroundColor: 'transparent',
      paddingBottom: 0,
      ...Platform.select({
        web: {
          boxShadow: 'none',
        } as any,
        ios: {},
        android: { elevation: 0 },
        default: {},
      }),
    },
    cardsContainer: {
      flex: 1,
      overflowY: 'auto',
      overflowX: 'hidden',
      paddingTop: DESIGN_TOKENS.spacing.md,
      paddingBottom: DESIGN_TOKENS.spacing.md,
      ...Platform.select({
        web: {
          scrollbarGutter: 'stable',
          minHeight: 0,
        },
      }),
    },
    cardsContainerMobile: {
      paddingBottom: (LAYOUT?.tabBarHeight ?? 56) + DESIGN_TOKENS.spacing.xl,
      ...(Platform.OS === 'web'
        ? ({
            minHeight: 0,
            scrollbarGutter: 'auto',
            // The actual list spacing is owned by the ScrollView content container on web.
            // Keep the outer wrapper flush to avoid a second reserved gap below the last card.
            paddingBottom: 0,
          } as any)
        : null),
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
    fallbackNotice: {
      marginBottom: DESIGN_TOKENS.spacing.sm,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingVertical: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      gap: DESIGN_TOKENS.spacing.xs,
    },
    fallbackNoticeTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    fallbackNoticeText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    fallbackNoticeAction: {
      alignSelf: 'flex-start',
      marginTop: DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.primarySoft,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    fallbackNoticeActionText: {
      color: colors.primaryText,
      fontSize: 13,
      fontWeight: '600',
    },
  })
