import { Platform, StyleSheet } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { ThemedColors } from '@/hooks/useTheme'

export const PHONE_COMPACT_LAYOUT_MAX_WIDTH = 767
export const PHONE_VERY_NARROW_LAYOUT_MAX_WIDTH = 430
const MOBILE_WEB_CONTROLS_CLEARANCE = 80
const DESKTOP_RADIUS_CLUSTER_MIN_WIDTH = 228
const DESKTOP_FILTER_FIELD_MIN_WIDTH = 172
const DESKTOP_TOOLBAR_MAX_WIDTH = 860
const CONTROL_RADIUS = DESIGN_TOKENS.radii.sm
const TOOLBAR_RADIUS = DESIGN_TOKENS.radii.lg
const PILL_RADIUS = DESIGN_TOKENS.radii.pill

const IS_WEB = Platform.OS === 'web'

export type Styles = ReturnType<typeof getStyles>

export const getStyles = (
  colors: ThemedColors,
  options: {
    isNarrow: boolean
    isVeryNarrow: boolean
    reserveLeftControlsSpace: boolean
  },
) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: options.isNarrow ? 8 : 16,
      left:
        Platform.OS === 'web' && options.isNarrow
          ? options.reserveLeftControlsSpace
            ? MOBILE_WEB_CONTROLS_CLEARANCE
            : 12
          : options.isNarrow
            ? 12
            : 16,
      right: options.isNarrow ? 12 : 16,
      zIndex: 5,
      ...(Platform.OS === 'web' && !options.isNarrow
        ? ({ maxWidth: DESKTOP_TOOLBAR_MAX_WIDTH } as any)
        : null),
    },
    row: {
      flexDirection: 'row',
      flexWrap: options.isNarrow ? 'wrap' : 'nowrap',
      rowGap: options.isVeryNarrow ? 6 : 8,
      gap: options.isVeryNarrow ? 6 : options.isNarrow ? 8 : 10,
      alignItems: 'stretch',
      alignSelf: 'flex-start',
      ...(IS_WEB && !options.isNarrow
        ? ({
            padding: 5,
            borderRadius: TOOLBAR_RADIUS,
            backgroundColor: colors.surfaceElevated,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            backdropFilter: 'blur(18px) saturate(1.05)',
            WebkitBackdropFilter: 'blur(18px) saturate(1.05)',
            boxShadow: colors.boxShadows.card,
          } as any)
        : null),
    },
    iconOnlyBar: {
      width: '100%',
      minHeight: options.isVeryNarrow ? 36 : options.isNarrow ? 40 : 42,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: options.isVeryNarrow ? 8 : 10,
      rowGap: 6,
    },
    iconOnlyGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: options.isVeryNarrow ? 6 : options.isNarrow ? 8 : 10,
      flexShrink: 0,
    },
    primaryCtaButton: {
      minHeight: options.isVeryNarrow ? 36 : options.isNarrow ? 40 : 42,
      maxWidth: options.isVeryNarrow ? 164 : options.isNarrow ? 188 : 212,
      paddingHorizontal: options.isVeryNarrow ? 10 : 12,
      borderRadius: CONTROL_RADIUS,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      flexShrink: 1,
      ...(IS_WEB
        ? ({
            boxShadow: colors.boxShadows.medium,
            cursor: 'pointer',
            transition: 'transform 0.18s ease, opacity 0.18s ease',
          } as any)
        : colors.shadows.light),
    },
    primaryCtaText: {
      color: colors.textOnPrimary,
      fontSize: options.isVeryNarrow ? 11 : 12,
      lineHeight: options.isVeryNarrow ? 14 : 15,
      fontWeight: '800',
      letterSpacing: 0,
      flexShrink: 1,
    },
    iconOnlyFiltersGroup: { flexShrink: 1, minWidth: 0, justifyContent: 'flex-end' },
    fieldWrap: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: options.isVeryNarrow ? 150 : options.isNarrow ? 160 : 180,
    },
    actionWrap: { flexShrink: 0 },
    radiusCluster: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: options.isVeryNarrow ? 36 : options.isNarrow ? 38 : 40,
      minWidth: options.isNarrow ? 0 : DESKTOP_RADIUS_CLUSTER_MIN_WIDTH,
      borderRadius: CONTROL_RADIUS,
      backgroundColor: IS_WEB ? colors.surfaceElevated : colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingLeft: options.isVeryNarrow ? 6 : 8,
      paddingRight: 4,
      ...(IS_WEB
        ? ({
            backdropFilter: 'blur(20px) saturate(1.12)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.12)',
            boxShadow: colors.boxShadows.medium,
          } as any)
        : colors.shadows.light),
    },
    radiusActionsGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: options.isVeryNarrow ? 4 : 6,
      paddingRight: options.isVeryNarrow ? 4 : 6,
    },
    radiusActionButton: {
      width: options.isVeryNarrow ? 28 : options.isNarrow ? 30 : 32,
      height: options.isVeryNarrow ? 28 : options.isNarrow ? 30 : 32,
      borderRadius: CONTROL_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      ...(IS_WEB
        ? ({ cursor: 'pointer', transition: 'transform 0.18s ease, opacity 0.18s ease' } as any)
        : null),
    },
    radiusDivider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      backgroundColor: colors.borderLight,
      opacity: 0.9,
      marginRight: 2,
    },
    radiusFieldWrap: { flex: 1, minWidth: 0 },
    radiusField: {
      flex: 1,
      minWidth: options.isNarrow ? 0 : 136,
      flexDirection: 'row',
      alignItems: 'center',
      gap: options.isVeryNarrow ? 6 : 8,
      minHeight: options.isVeryNarrow ? 36 : options.isNarrow ? 38 : 40,
      paddingHorizontal: options.isVeryNarrow ? 8 : 10,
      paddingVertical: 4,
      backgroundColor: 'transparent',
      borderRadius: CONTROL_RADIUS,
      ...(IS_WEB
        ? ({ cursor: 'pointer', transition: 'transform 0.18s ease, opacity 0.18s ease' } as any)
        : null),
    },
    field: {
      flex: options.isNarrow ? 1 : 0,
      minWidth: options.isNarrow ? 0 : DESKTOP_FILTER_FIELD_MIN_WIDTH,
      flexDirection: 'row',
      alignItems: 'center',
      gap: options.isVeryNarrow ? 6 : 8,
      minHeight: options.isVeryNarrow ? 36 : options.isNarrow ? 38 : 40,
      paddingHorizontal: options.isVeryNarrow ? 10 : 12,
      paddingVertical: 4,
      borderRadius: CONTROL_RADIUS,
      backgroundColor: IS_WEB ? colors.surfaceElevated : colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...(IS_WEB
        ? ({
            backdropFilter: 'blur(20px) saturate(1.12)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.12)',
            boxShadow: colors.boxShadows.medium,
            cursor: 'pointer',
            transition: 'transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease',
          } as any)
        : colors.shadows.light),
    },
    fieldPressed: {
      opacity: 0.85,
      ...(IS_WEB ? ({ transform: 'translateY(0px) scale(0.985)' } as any) : null),
    },
    iconButton: {
      width: options.isVeryNarrow ? 36 : options.isNarrow ? 40 : 42,
      height: options.isVeryNarrow ? 36 : options.isNarrow ? 40 : 42,
      flexBasis: options.isVeryNarrow ? 36 : options.isNarrow ? 40 : 42,
      flexShrink: 0,
      borderRadius: CONTROL_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: IS_WEB ? colors.surfaceElevated : colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...(IS_WEB
        ? ({
            backdropFilter: 'blur(18px) saturate(1.08)',
            WebkitBackdropFilter: 'blur(18px) saturate(1.08)',
            boxShadow: colors.boxShadows.medium,
            cursor: 'pointer',
          } as any)
        : colors.shadows.light),
    },
    iconTextButton: {
      minWidth: options.isVeryNarrow ? 54 : options.isNarrow ? 60 : 66,
      maxWidth: options.isVeryNarrow ? 62 : options.isNarrow ? 70 : 78,
      height: options.isVeryNarrow ? 36 : options.isNarrow ? 40 : 42,
      paddingHorizontal: options.isVeryNarrow ? 8 : 10,
      flexShrink: 0,
      borderRadius: CONTROL_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: IS_WEB ? colors.surfaceElevated : colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...(IS_WEB
        ? ({
            backdropFilter: 'blur(18px) saturate(1.08)',
            WebkitBackdropFilter: 'blur(18px) saturate(1.08)',
            boxShadow: colors.boxShadows.medium,
            cursor: 'pointer',
          } as any)
        : colors.shadows.light),
    },
    iconTextButtonText: {
      maxWidth: '100%',
      fontSize: options.isVeryNarrow ? 11 : 12,
      lineHeight: options.isVeryNarrow ? 14 : 15,
      fontWeight: '800',
      color: colors.primaryDark,
      letterSpacing: 0,
    },
    iconButtonIcon: { flexShrink: 0 },
    iconButtonActive: {
      borderColor: colors.primary,
      backgroundColor: IS_WEB ? colors.surfaceAlpha40 : colors.surface,
      ...(IS_WEB
        ? ({ boxShadow: `0 0 0 1px ${colors.primary}, ${colors.boxShadows.light}` } as any)
        : null),
    },
    iconBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 16,
      height: 16,
      paddingHorizontal: 4,
      borderRadius: PILL_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderWidth: 1.5,
      borderColor: colors.surface,
    },
    iconBadgeText: {
      color: colors.textOnPrimary,
      fontSize: 10,
      lineHeight: 12,
      fontWeight: '800',
    },
    fieldIcon: { flexShrink: 0 },
    fieldLabel: {
      fontSize: options.isVeryNarrow ? 12 : 13,
      fontWeight: '600',
      color: colors.textMuted,
      letterSpacing: 0,
      flexShrink: 1,
      minWidth: 0,
    },
    fieldLabelHidden: {
      ...(IS_WEB ? ({ display: 'none' } as any) : { width: 0, height: 0, opacity: 0 }),
    },
    fieldValue: {
      marginLeft: 'auto',
      fontSize: options.isVeryNarrow ? 12 : 13,
      fontWeight: '700',
      color: colors.text,
      flexShrink: 0,
      maxWidth: options.isVeryNarrow ? 90 : options.isNarrow ? 116 : 142,
    },
    fieldCaret: { flexShrink: 0, opacity: 0.5 },
  })
