import { Platform } from 'react-native'
import type { StylesCtx } from './tokens'

export const createGroupStyles = (ctx: StylesCtx) => {
  const { colors, spacing, typography, radii, CONTROL_RADIUS } = ctx

  return {
    scrollView: {
      flex: 1,
      ...Platform.select({
        web: {
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none' as any,
          msOverflowStyle: 'none' as any,
        } as any,
      }),
    },
    scrollContent: {
      paddingBottom: spacing.xs,
    },
    filterGroup: {
      marginBottom: spacing.xxs,
      paddingBottom: spacing.xxs,
    },
    filterGroupLast: {
      marginBottom: 0,
      paddingBottom: 0,
    },
    groupHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 0,
      minHeight: 42,
      ...Platform.select({
        web: {
          cursor: 'pointer' as any,
        } as any,
      }),
    },
    groupHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flex: 1,
      minWidth: 0,
    },
    groupHeaderButton: {
      minHeight: 42,
      paddingVertical: 7,
      paddingHorizontal: spacing.sm,
      borderRadius: CONTROL_RADIUS,
      borderWidth: 1,
      borderColor: 'transparent',
      ...Platform.select({
        web: {
          transition: 'all 0.18s ease',
        },
      }),
    },
    groupHeaderButtonExpanded: {
      backgroundColor: colors.brandSoft,
      borderColor: colors.brandAlpha30,
    },
    groupHeaderButtonPressed: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.borderLight,
    },
    groupHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flexShrink: 0,
      marginLeft: spacing.xs,
    },
    groupTitle: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.bold as any,
      color: colors.text,
      letterSpacing: -0.2,
      flexShrink: 1,
    },
    selectedBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.pill,
      minWidth: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      ...Platform.select({
        web: {
          boxShadow: `0 4px 10px -2px ${colors.primaryAlpha30}, 0 0 0 2px ${colors.surface}`,
        } as any,
      }),
    },
    selectedBadgeText: {
      fontSize: 12,
      fontWeight: typography.weights.bold as any,
      color: colors.textOnPrimary,
      lineHeight: 16,
      letterSpacing: 0.2,
    },
    selectedSummaryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.xxs,
      marginBottom: spacing.xs,
      paddingVertical: 4,
      paddingHorizontal: spacing.xs,
      borderRadius: radii.md,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
    },
    selectedSummaryChip: {
      minHeight: 26,
      maxWidth: '100%',
      paddingHorizontal: spacing.xs,
      paddingVertical: 4,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      justifyContent: 'center',
    },
    selectedSummaryText: {
      fontSize: typography.sizes.xs,
      color: colors.primaryText,
      lineHeight: 16,
      fontWeight: typography.weights.semibold as any,
    },
    groupContent: {
      marginTop: spacing.xs,
      overflow: 'hidden',
    },
  } as const
}
