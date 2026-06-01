import { StyleSheet, Platform } from 'react-native'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import {
  CONTROL_RADIUS,
  PILL_RADIUS,
  type FiltersPanelStyleContext,
} from './context'

export const getRouteStyles = ({ colors }: FiltersPanelStyleContext) =>
  ({
    routeInfo: {
      backgroundColor: colors.surfaceAlpha40,
      borderRadius: CONTROL_RADIUS,
      padding: 9,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      ...Platform.select({
        web: {
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: 'none',
        } as any,
        default: DESIGN_TOKENS.shadowsNative.light,
      }),
    },
    routeDistance: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.primaryText,
    },
    footer: {
      marginTop: 8,
      paddingTop: 8,
    },
    infoText: {
      fontSize: 13,
      color: colors.text,
      fontWeight: '700',
    },
    stepItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 9,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.surfaceAlpha40,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    stepBadge: {
      width: 28,
      height: 28,
      borderRadius: PILL_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBadgeText: {
      color: colors.textOnPrimary,
      fontWeight: '800',
      fontSize: 12,
    },
    stepContent: {
      flex: 1,
      gap: 2,
    },
    stepTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    stepSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
    },
    noPointsToast: {
      marginTop: 6,
      padding: 8,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    noPointsTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
    },
    noPointsSubtitle: {
      fontSize: 11,
      color: colors.textMuted,
      lineHeight: 16,
    },
    noPointsActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
    },
    statusCard: {
      backgroundColor: colors.surfaceAlpha40,
      borderRadius: CONTROL_RADIUS,
      padding: 9,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      ...Platform.select({
        web: {
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: 'none',
        } as any,
        default: DESIGN_TOKENS.shadowsNative.light,
      }),
    },
    accordionHeader: {
      marginTop: 2,
      marginBottom: 4,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    accordionTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
  }) as const
