import { Platform } from 'react-native'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { StylesCtx } from './tokens'

export const createContainerHeaderStyles = (ctx: StylesCtx) => {
  const {
    colors,
    spacing,
    typography,
    mobileWebTopReserve,
    PANEL_RADIUS,
    PILL_RADIUS,
  } = ctx

  return {
    container: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: PANEL_RADIUS,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      ...Platform.select({
        web: {
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 12px 32px -16px rgba(15, 23, 42, 0.18)' as any,
          width: '100%',
          position: 'sticky' as any,
          top: spacing.md,
          maxHeight: 'calc(100vh - 24px)' as any,
          overflowY: 'auto' as any,
          backdropFilter: 'blur(16px) saturate(1.1)',
          backgroundImage: `linear-gradient(180deg, ${colors.surface} 0%, ${colors.backgroundSecondary} 100%)` as any,
        } as any,
        default: {},
      }),
    },
    containerMobile: {
      flex: 1,
      borderRadius: PANEL_RADIUS,
      borderTopLeftRadius: PANEL_RADIUS,
      borderTopRightRadius: PANEL_RADIUS,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl,
      backgroundColor: colors.surface,
      elevation: 0,
      ...Platform.select({
        web: {
          boxShadow: ((colors.boxShadows as any)?.modal ?? DESIGN_TOKENS.shadows.modal) as any,
        } as any,
        ios: {
          shadowColor: DESIGN_TOKENS.colors.text,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        },
      }),
    },
    containerWebFull: {
      width: '100%',
      maxWidth: '100%',
      height: `calc(100dvh - ${mobileWebTopReserve}px)` as any,
      borderRadius: 0,
      borderWidth: 0,
      position: 'relative',
      top: 0,
      minHeight: 0,
      maxHeight: `calc(100dvh - ${mobileWebTopReserve}px)` as any,
      boxShadow: 'none' as any,
      display: 'flex' as any,
      flexDirection: 'column' as any,
      overflowY: 'hidden' as any,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 0,
    },
    containerCompact: {
      padding: spacing.md,
      ...Platform.select({
        web: {
          width: 240,
        },
      }),
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    headerStacked: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.bold as any,
      color: colors.text,
      letterSpacing: -0.2,
    },
    optionalHint: {
      fontSize: typography.sizes.xs,
      color: colors.textMuted,
      flexShrink: 0,
    },
    headerCountChip: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: PILL_RADIUS,
      backgroundColor: colors.brandSoft,
      borderWidth: 1,
      borderColor: colors.brandAlpha30,
      flexShrink: 0,
      maxWidth: '100%',
      alignSelf: 'flex-start',
      ...Platform.select({
        web: {
          boxShadow: `0 1px 0 ${colors.brandAlpha30} inset` as any,
        } as any,
      }),
    },
    headerCountChipText: {
      fontSize: typography.sizes.xs,
      color: colors.brandText,
      fontWeight: typography.weights.bold as any,
      letterSpacing: 0.1,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flex: 1,
      minWidth: 0,
    },
    headerLeftStacked: {
      flex: 1,
      minWidth: 0,
    },
    iconSlot16: {
      width: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    iconSlot18: {
      width: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flexShrink: 0,
    },
    headerRightStacked: {
      width: 'auto',
      justifyContent: 'flex-end',
      flexShrink: 0,
    },
    closeButton: {
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
          transition: 'all 0.18s ease',
        },
      }),
    },
    closeButtonPressed: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
    },
    topChrome: {
      backgroundColor: colors.surface,
      zIndex: 3,
      borderBottomColor: colors.borderLight,
    },
    topChromeCompact: {
      ...Platform.select({
        web: {
          position: 'sticky' as any,
          top: 0,
          paddingTop: 0,
          paddingBottom: spacing.xs,
        } as any,
      }),
    },
  } as const
}
