import { Platform } from 'react-native'
import type { StylesCtx } from './tokens'

export const createOptionStyles = (ctx: StylesCtx) => {
  const { colors, spacing, typography, radii, CONTROL_RADIUS } = ctx

  return {
    filterOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: CONTROL_RADIUS,
      marginBottom: spacing.xxs,
      borderWidth: 1,
      borderColor: 'transparent',
      minHeight: 42,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'all 0.18s ease',
        },
      }),
    },
    filterOptionHover: Platform.select({
      web: {
        backgroundColor: colors.surfaceMuted,
      } as any,
    }),
    filterOptionSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryAlpha30,
    },
    filterOptionText: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: colors.text,
      marginLeft: spacing.sm,
      fontWeight: typography.weights.regular as any,
    },
    sortOptionText: {
      flex: 1,
      fontSize: typography.sizes.md,
      color: colors.text,
      marginLeft: spacing.sm,
      fontWeight: typography.weights.medium as any,
    },
    filterOptionTextSelected: {
      color: colors.primaryDark,
      fontWeight: typography.weights.medium as any,
    },
    filterOptionCount: {
      fontSize: typography.sizes.xs,
      color: colors.textMuted,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: radii.pill,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: radii.sm,
      borderWidth: 2,
      borderColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    radioLarge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    radioChecked: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    radioDotLarge: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.primary,
    },
  } as const
}
