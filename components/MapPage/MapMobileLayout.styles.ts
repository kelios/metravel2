import { Platform, StyleSheet } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { ThemedColors } from '@/hooks/useTheme'

const MOBILE_WEB_BOTTOM_CHROME_GAP = 28

type MapMobileLayoutStyleOptions = {
  isNarrow: boolean
  compactSheetActions: boolean
  stackSheetToolbar: boolean
  isSheetPreview: boolean
}

export const getMapMobileLayoutStyles = (
  colors: ThemedColors,
  options: MapMobileLayoutStyleOptions,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      ...(Platform.OS === 'web'
        ? ({
            height: '100%',
            maxHeight: '100vh',
            overflow: 'hidden',
          } as any)
        : null),
    },
    mapContainer: {
      flex: 1,
      minHeight: 240,
      ...(Platform.OS === 'web'
        ? ({
            overflow: 'hidden',
            position: 'relative',
          } as any)
        : null),
    },
    sheetRoot: {
      flex: 1,
      minHeight: 0,
      width: '100%',
      ...Platform.select({
        web: {
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        } as any,
      }),
    },
    sheetRootPreview: {
      backgroundColor: colors.surfaceAlpha40,
    },
    sheetToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: options.isNarrow ? 6 : 8,
      minHeight: options.isNarrow ? 38 : 42,
      paddingVertical: options.isNarrow ? 4 : 6,
      paddingLeft: options.isNarrow ? 10 : 12,
      paddingRight: options.isNarrow ? 8 : 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
      backgroundColor: colors.surface,
      ...(Platform.OS === 'web'
        ? ({
            backgroundColor: colors.surfaceAlpha40,
            boxShadow: '0 3px 10px rgba(15,23,42,0.05)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            position: 'relative',
            zIndex: 1,
          } as any)
        : {
            shadowColor: DESIGN_TOKENS.colors.text,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 3,
            elevation: 2,
          }),
    },
    sheetToolbarPreview: {
      minHeight: options.isNarrow ? 36 : 40,
      paddingVertical: options.isNarrow ? 3 : 5,
      paddingLeft: options.isNarrow ? 8 : 12,
      paddingRight: options.isNarrow ? 8 : 12,
      backgroundColor: colors.backgroundSecondary,
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: 'none',
          } as any)
        : null),
    },
    sheetToolbarActions: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      flexShrink: 0,
    },
    sheetToolbarActionsPreview: {
      gap: 6,
    },
    sheetToolbarActionsStacked: {},
    sheetToolbarActionsFloatingClose: {},
    sheetToolbarCloseOnly: {},
    sheetCloseButton: {
      width: options.isNarrow ? 36 : 38,
      height: options.isNarrow ? 36 : 38,
      borderRadius: 11,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      backgroundColor: colors.surfaceAlpha40,
      flexShrink: 0,
      marginHorizontal: 0,
      ...(Platform.OS === 'web'
        ? ({
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          } as any)
        : {
            shadowColor: DESIGN_TOKENS.colors.text,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 3,
            elevation: 1,
          }),
    },
    sheetToolbarCloseButton: {
      backgroundColor: colors.surface,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 8px 20px rgba(15,23,42,0.10)',
          } as any)
        : {
            shadowOpacity: 0.08,
            shadowRadius: 4,
            elevation: 2,
          }),
    },
    sheetToolbarCloseButtonFloating: {},
    sheetShowResultsButton: {
      flexDirection: 'row' as const,
      height: options.isNarrow ? 34 : 38,
      minWidth: options.isNarrow ? 34 : 38,
      paddingHorizontal: options.isNarrow ? 8 : 10,
      gap: 4,
      borderRadius: 999,
      borderWidth: 0,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      flexShrink: 0,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: 'none', cursor: 'pointer' } as any)
        : null),
    },
    sheetShowResultsButtonCompact: {
      height: 36,
      minWidth: 36,
      paddingHorizontal: 8,
    },
    sheetPrimaryActionText: {
      fontSize: options.isNarrow ? 12 : 13,
      fontWeight: '800' as const,
      color: colors.textOnPrimary,
      letterSpacing: 0.1,
    },
    sheetToolbarButtonStacked: {
      minWidth: 0,
    },
    sheetIconButtonCompact: {
      width: 36,
      height: 36,
      borderRadius: 11,
    },
    sheetIconButtonStacked: {
      minWidth: 0,
      borderRadius: 14,
    },
    sheetResultsBadge: {
      fontSize: options.compactSheetActions ? 10 : 11,
      fontWeight: '700' as const,
      lineHeight: 14,
      backgroundColor: 'rgba(255,255,255,0.20)',
      borderRadius: 999,
      paddingHorizontal: options.compactSheetActions ? 5 : 6,
      paddingVertical: 1,
      overflow: 'hidden' as const,
    },
    sheetToolbarLeft: {
      flex: 1,
      minWidth: 0,
      flexShrink: 1,
      gap: 4,
    },
    sheetToolbarLeftWithFloatingClose: {},
    sheetToolbarSummary: {
      marginTop: 2,
      paddingHorizontal: 2,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: '600' as const,
      color: colors.textMuted,
      letterSpacing: 0,
    },
    sheetToolbarSummaryPreview: {
      marginTop: 2,
      fontSize: 11,
      lineHeight: 14,
    },
    sheetToolbarRight: {
      flexShrink: 0,
    },
    sheetToolbarInline: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sheetToolbarStacked: {},
    sheetToolbarFullWidth: {},
    sheetIconButton: {
      width: 36,
      height: 36,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      backgroundColor: colors.surfaceAlpha40,
      flexShrink: 0,
      marginHorizontal: 0,
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
      ...Platform.select({
        web: {
          alignSelf: 'flex-end',
        },
      }),
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.12s ease',
          } as any)
        : null),
    },
    sheetResetButton: {
      paddingHorizontal: 9,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      backgroundColor: colors.surfaceAlpha40,
      marginHorizontal: 0,
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
      ...Platform.select({
        web: {
          alignSelf: 'flex-end',
          boxShadow: 'none',
          cursor: 'pointer',
        } as any,
      }),
    },
    sheetBody: {
      flex: 1,
      minHeight: 0,
      ...Platform.select({
        web: {
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          paddingHorizontal: options.isNarrow ? 2 : 6,
        },
      }),
    },
    sheetFallback: {
      flex: 1,
      minHeight: 220,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: options.isNarrow ? 18 : 24,
      paddingVertical: options.isNarrow ? 18 : 24,
    },
    sheetFallbackTitle: {
      fontSize: 15,
      fontWeight: '700' as const,
      color: colors.text,
      textAlign: 'center' as const,
    },
    sheetFallbackHint: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textMuted,
      textAlign: 'center' as const,
      maxWidth: 280,
    },
    sheetBodyPreview: {
      ...Platform.select({
        web: {
          paddingHorizontal: options.isNarrow ? 4 : 8,
        },
        default: {},
      }),
    },
    filtersPeek: {
      gap: 8,
      paddingHorizontal: options.isNarrow ? 8 : 12,
      paddingBottom: 2,
    },
    filtersModeBar: {
      paddingHorizontal: options.isNarrow ? 8 : 12,
      paddingTop: options.isNarrow ? 4 : 6,
      paddingBottom: options.isNarrow ? 2 : 2,
    },
    filtersPeekCtaRow: {
      paddingHorizontal: options.isNarrow ? 0 : 2,
      paddingBottom: 2,
    },
    fab: {
      bottom:
        Platform.OS === 'web'
          ? (`calc(${options.isNarrow ? 116 : 128}px + env(safe-area-inset-bottom) + ${MOBILE_WEB_BOTTOM_CHROME_GAP}px)` as any)
          : options.isNarrow
            ? 116
            : 128,
      right: options.isNarrow ? 12 : 14,
    },
  })
