import { Platform } from 'react-native'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { StylesCtx } from './tokens'

export const createFooterStyles = (ctx: StylesCtx) => {
  const { colors, spacing, typography, PILL_RADIUS } = ctx

  return {
    applyButtonContainer: {
      marginTop: spacing.sm,
      paddingTop: spacing.md,
      paddingHorizontal: spacing.xs,
      paddingBottom: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      backgroundColor: colors.surface,
      ...Platform.select({
        web: {
          gap: spacing.xs,
          position: 'sticky' as any,
          bottom: 0,
          paddingBottom: `calc(${spacing.md}px + env(safe-area-inset-bottom))` as any,
          boxShadow: ((colors.boxShadows as any)?.light ?? DESIGN_TOKENS.shadows.light) as any,
        } as any,
      }),
    },
    resetMobileButton: {
      paddingVertical: spacing.sm,
      borderRadius: PILL_RADIUS,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.backgroundSecondary,
      marginBottom: spacing.xs,
    },
    resetMobileButtonPressed: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
    },
    resetMobileButtonText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium as any,
      color: colors.textMuted,
    },
    applyButton: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: PILL_RADIUS,
      alignItems: 'center',
      overflow: 'hidden',
      ...Platform.select({
        web: {
          boxShadow: `0 8px 20px -8px ${colors.primaryAlpha30}, 0 2px 4px rgba(15, 23, 42, 0.08)` as any,
          transition: 'all 0.18s ease',
        } as any,
        ios: {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.4,
          shadowRadius: 20,
        },
      }),
    },
    applyButtonPressed: {
      backgroundColor: colors.primaryDark,
      ...Platform.select({
        web: {
          transform: 'translateY(-1px)',
          boxShadow: ((colors.boxShadows as any)?.hover ?? DESIGN_TOKENS.shadows.hover) as any,
        } as any,
      }),
    },
    applyButtonText: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.bold as any,
      color: colors.textOnPrimary,
      letterSpacing: 0,
    },
  } as const
}
