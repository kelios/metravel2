import { Platform, StyleSheet } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { ThemedColors } from '@/hooks/useTheme'

const BUTTON_SIZE = 38

const shadowWeb = {
  boxShadow: '0 2px 10px rgba(15,23,42,0.12)',
} as const

const shadowNative = {
  shadowColor: DESIGN_TOKENS.colors.text,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.12,
  shadowRadius: 6,
  elevation: 4,
} as const

export const getMapMobileTopOverlayStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    root: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1500,
      paddingHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      // Правая группа остаётся одноcтрочной даже на узких телефонах:
      // видимая кнопка 38px, touch-target добирается hitSlop в компоненте.
      // Локация вынесена в левый край root, поэтому ряд не перегружает 320px.
      gap: 6,
    },
    toolbarStack: {
      alignItems: 'flex-end' as const,
      gap: 6,
    },
    routeToolbar: {
      flexDirection: 'row',
      alignItems: 'center' as const,
      gap: 8,
    },
    iconButton: {
      width: BUTTON_SIZE,
      height: BUTTON_SIZE,
      borderRadius: BUTTON_SIZE / 2,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      // Статичный «фрост»-фон (правило проекта: без живого blur на мобиле).
      backgroundColor: colors.surface,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
      ...(Platform.OS === 'web' ? shadowWeb : shadowNative),
    },
    iconButtonPressed: {
      opacity: 0.85,
    },
    iconButtonActive: {
      backgroundColor: colors.primarySoft,
    },
    badge: {
      position: 'absolute' as const,
      top: -3,
      right: -3,
      minWidth: 18,
      height: 16,
      paddingHorizontal: 4,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderWidth: 1.5,
      borderColor: colors.surface,
    },
    routeProgressBadge: {
      position: 'absolute' as const,
      top: -3,
      right: -6,
      minWidth: 24,
      height: 16,
      paddingHorizontal: 4,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderWidth: 1.5,
      borderColor: colors.surface,
    },
    badgeText: {
      fontSize: 9,
      lineHeight: 11,
      fontWeight: '700' as const,
      color: colors.textOnPrimary,
    },
    routeHint: {
      position: 'absolute' as const,
      top: BUTTON_SIZE + 54,
      left: 10,
      right: 10,
      flexDirection: 'row',
      alignItems: 'center' as const,
      flexWrap: 'wrap' as const,
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 10,
      // Статичный «фрост»-фон (правило проекта: без живого blur на мобиле).
      backgroundColor: colors.surfaceMuted,
      ...(Platform.OS === 'web' ? shadowWeb : shadowNative),
    },
    routeHintText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 15,
      fontWeight: '600' as const,
      color: colors.text,
    },
    routeHintActions: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center' as const,
      gap: 6,
      marginTop: 2,
    },
    routeHintActionPrimary: {
      minHeight: 32,
      flexGrow: 1,
      flexBasis: 0,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingHorizontal: 10,
      borderRadius: 9,
      backgroundColor: colors.primary,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    routeHintActionSecondary: {
      minHeight: 32,
      flexGrow: 1,
      flexBasis: 0,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingHorizontal: 10,
      borderRadius: 9,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    routeHintActionPressed: {
      opacity: 0.75,
    },
    routeHintActionPrimaryText: {
      fontSize: 12,
      lineHeight: 14,
      fontWeight: '700' as const,
      color: colors.textOnPrimary,
    },
    routeHintActionSecondaryText: {
      fontSize: 12,
      lineHeight: 14,
      fontWeight: '700' as const,
      color: colors.text,
    },
    routeSummaryCard: {
      width: 244,
      maxWidth: '100%' as any,
      paddingVertical: 9,
      paddingHorizontal: 11,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...(Platform.OS === 'web' ? shadowWeb : shadowNative),
    },
    routeSummaryHeader: {
      flexDirection: 'row',
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: 8,
      marginBottom: 7,
    },
    routeSummaryTitleRow: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center' as const,
      gap: 6,
    },
    routeSummaryTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: 12,
      lineHeight: 15,
      fontWeight: '700' as const,
      color: colors.text,
    },
    routeSummaryClose: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: colors.surfaceMuted,
      flexShrink: 0,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    routeSummaryClosePressed: {
      opacity: 0.75,
    },
    routeSummaryMetrics: {
      flexDirection: 'row',
      alignItems: 'center' as const,
      flexWrap: 'wrap' as const,
      gap: 6,
    },
    routeSummaryMetric: {
      minHeight: 28,
      flexDirection: 'row',
      alignItems: 'center' as const,
      gap: 5,
      paddingVertical: 5,
      paddingHorizontal: 8,
      borderRadius: 9,
      backgroundColor: colors.primarySoft,
      flexShrink: 0,
    },
    routeSummaryMetricText: {
      fontSize: 12,
      lineHeight: 14,
      fontWeight: '700' as const,
      color: colors.primaryDark,
    },
    routeSummaryNote: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '600' as const,
      color: colors.textMuted,
    },
  })
