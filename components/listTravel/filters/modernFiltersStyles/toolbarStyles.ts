import { Platform } from 'react-native'
import type { StylesCtx } from './tokens'

export const createToolbarStyles = (ctx: StylesCtx) => {
  const { colors, spacing, typography, CONTROL_RADIUS, PILL_RADIUS } = ctx

  return {
    toggleAllButton: {
      width: 40,
      height: 40,
      padding: 0,
      borderRadius: PILL_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'all 0.18s ease',
        },
      }),
    },
    toggleAllButtonWide: {
      width: 'auto',
      minWidth: 40,
      paddingHorizontal: spacing.sm,
    },
    toggleAllButtonPressed: {
      backgroundColor: colors.brandSoft,
      borderColor: colors.brandAlpha30,
    },
    toggleAllButtonInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    toggleAllButtonText: {
      fontSize: typography.sizes.xs,
      color: colors.primary,
      fontWeight: typography.weights.semibold as any,
    },
    clearButton: {
      minHeight: 36,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: PILL_RADIUS,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.brandAlpha30,
      ...Platform.select({
        web: {
          transition: 'all 0.2s ease',
        },
      }),
    },
    clearButtonText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold as any,
      color: colors.brandText,
    },
    clearButtonCountBadge: {
      minWidth: 22,
      height: 22,
      paddingHorizontal: 6,
      borderRadius: PILL_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.brandSoft,
      borderWidth: 1,
      borderColor: colors.brandAlpha30,
    },
    clearButtonCountText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold as any,
      color: colors.brandText,
      lineHeight: 14,
    },
    clearAllMobileButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: 10,
      paddingHorizontal: spacing.sm,
      borderRadius: CONTROL_RADIUS,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.borderLight,
      marginBottom: spacing.xs,
      ...Platform.select({
        web: {
          cursor: 'pointer',
        },
      }),
    },
    clearAllMobileButtonText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium as any,
      color: colors.textSecondary,
    },
    resultsBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      minHeight: 32,
      borderRadius: CONTROL_RADIUS,
      borderWidth: 1,
      borderColor: colors.borderLight,
      marginBottom: spacing.xs,
    },
    resultsBadgeText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium as any,
      color: colors.textSecondary,
    },
    clearAllMobileButtonPressed: {
      backgroundColor: colors.backgroundSecondary,
      borderColor: colors.border,
    },
    clearButtonPressed: {
      backgroundColor: colors.brandSoft,
      borderColor: colors.brandAlpha40,
    },
  } as const
}
