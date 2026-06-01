import { Platform } from 'react-native'
import type { StylesCtx } from './tokens'

export const createExtraFiltersStyles = (ctx: StylesCtx) => {
  const { colors, spacing, typography, CONTROL_RADIUS } = ctx

  return {
    extraFilters: {
      marginBottom: spacing.xxs,
      gap: spacing.xs,
    },
    yearGroup: {
      borderRadius: CONTROL_RADIUS,
      backgroundColor: colors.surface,
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    yearInlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    yearGroupContent: {
      marginTop: spacing.sm,
    },
    yearRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    yearLabelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flex: 1,
    },
    yearLabel: {
      fontSize: typography.sizes.sm,
      color: colors.text,
      fontWeight: typography.weights.semibold as any,
    },
    yearInput: {
      flexBasis: 128,
      maxWidth: 128,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderRadius: CONTROL_RADIUS,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundSecondary,
      fontSize: Math.max(Number(typography.sizes.sm) || 0, 16),
      fontWeight: typography.weights.semibold as any,
      textAlign: 'center',
      alignSelf: 'flex-start',
      minHeight: 42,
      letterSpacing: 0.6,
      ...Platform.select({
        web: {
          outlineWidth: 0,
          transition: 'all 0.2s ease',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)' as any,
        } as any,
      }),
    },
    yearInputFocused: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
      ...Platform.select({
        web: {
          boxShadow: `0 0 0 3px ${colors.primaryAlpha30}` as any,
        } as any,
      }),
    },
    moderationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 6,
      paddingHorizontal: spacing.xs,
      borderRadius: CONTROL_RADIUS,
      borderWidth: 1,
      borderColor: 'transparent',
      ...Platform.select({
        web: {
          cursor: 'pointer',
        },
      }),
    },
    moderationRowSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryAlpha30,
    },
    moderationRowPressed: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.borderLight,
    },
    moderationLabel: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    moderationLabelSelected: {
      color: colors.primaryDark,
      fontWeight: typography.weights.medium as any,
    },
  } as const
}
