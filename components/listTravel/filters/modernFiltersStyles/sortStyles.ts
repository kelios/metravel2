import { Platform } from 'react-native'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { StylesCtx } from './tokens'

export const createSortStyles = (ctx: StylesCtx) => {
  const { colors, spacing, typography, CONTROL_RADIUS, MENU_RADIUS } = ctx

  return {
    sortSection: {
      marginBottom: spacing.sm,
      borderRadius: MENU_RADIUS,
      borderWidth: 0,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
      overflow: 'visible',
    },
    sortDropdownTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 48,
      paddingVertical: 9,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: CONTROL_RADIUS,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)' as any,
        } as any,
      }),
    },
    sortDropdownTriggerHover: Platform.select({
      web: {
        backgroundColor: colors.backgroundSecondary,
        borderColor: colors.border,
      } as any,
    }),
    sortDropdownTriggerActive: {
      backgroundColor: colors.surface,
      borderColor: colors.primaryAlpha30,
    },
    sortDropdownTriggerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flex: 1,
    },
    sortDropdownIcon: {
      width: 28,
      height: 28,
      borderRadius: CONTROL_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
    },
    sortDropdownTextContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.xs,
      flexWrap: 'wrap',
    },
    sortDropdownLabel: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      fontWeight: typography.weights.medium as any,
    },
    sortDropdownValue: {
      fontSize: typography.sizes.sm,
      color: colors.text,
      fontWeight: typography.weights.semibold as any,
    },
    sortDropdownChevron: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sortDropdownContent: {
      marginTop: spacing.xs,
      padding: 6,
      backgroundColor: colors.surface,
      borderRadius: CONTROL_RADIUS,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: 4,
      ...Platform.select({
        web: {
          boxShadow: ((colors.boxShadows as any)?.card ?? DESIGN_TOKENS.shadows.card) as any,
        } as any,
      }),
    },
    sortOption: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: 'transparent',
      marginBottom: 0,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.xs,
      borderRadius: CONTROL_RADIUS,
      ...Platform.select({
        web: {
          transition: `all ${DESIGN_TOKENS.animations.duration.fast}ms ${DESIGN_TOKENS.animations.easing.default}`,
        },
      }),
    },
    sortOptionCompact: {
      paddingVertical: 8,
      paddingHorizontal: spacing.sm,
      minHeight: 40,
    },
    sortOptionSelected: {
      backgroundColor: colors.brandSoft,
      borderColor: colors.brandAlpha30,
    },
    sortOptionHover: Platform.select({
      web: {
        backgroundColor: colors.surfaceMuted,
      } as any,
    }),
    sortIconContainer: {
      width: 28,
      height: 28,
      borderRadius: CONTROL_RADIUS,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sortIconContainerSelected: {
      backgroundColor: colors.brandAlpha30,
    },
    sortCheckIcon: {
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sortOptionTextSelected: {
      color: colors.brandDark,
      fontWeight: typography.weights.semibold as any,
    },
  } as const
}
