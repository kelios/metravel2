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
    quickActionsRail: {
      position: 'absolute',
      right: options.isNarrow ? 12 : 16,
      gap: options.isNarrow ? 8 : 10,
      zIndex: 810,
      alignItems: 'flex-end',
    },
    quickSecondaryActions: {
      flexDirection: 'column',
      gap: options.isNarrow ? 8 : 10,
      alignItems: 'flex-end',
    },
    quickCircleButton: {
      width: options.isNarrow ? 44 : 48,
      height: options.isNarrow ? 44 : 48,
      borderRadius: options.isNarrow ? 22 : 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 8px 18px rgba(0,0,0,0.14)',
            cursor: 'pointer',
          } as any)
        : {
            shadowColor: DESIGN_TOKENS.colors.text,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 10,
            elevation: 3,
          }),
    },
    sheetRoot: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minHeight: 0,
    },
    sheetRootPreview: {
      backgroundColor: colors.backgroundSecondary,
    },
    sheetToolbar: {
      flexDirection: options.stackSheetToolbar ? 'column' : 'row',
      alignItems: options.stackSheetToolbar ? 'stretch' : 'center',
      gap: options.stackSheetToolbar ? 6 : options.isNarrow ? 4 : 8,
      minHeight: options.stackSheetToolbar
        ? undefined
        : options.isNarrow
          ? 40
          : 48,
      paddingVertical: options.isNarrow ? 4 : 8,
      paddingLeft: options.isNarrow ? 8 : 14,
      paddingRight: options.isNarrow ? 8 : 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
      backgroundColor: colors.surface,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          } as any)
        : {
            shadowColor: DESIGN_TOKENS.colors.text,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 3,
            elevation: 2,
          }),
      ...Platform.select({
        web: {
          position: 'sticky' as any,
          top: 0,
          zIndex: 10,
        },
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
      gap: 4,
      flexShrink: 0,
    },
    sheetToolbarActionsPreview: {
      gap: 6,
    },
    sheetToolbarActionsStacked: {
      width: '100%',
      flexDirection: 'column' as const,
      alignItems: 'stretch' as const,
      justifyContent: 'flex-start' as const,
      gap: 8,
    },
    sheetCloseButton: {
      width: options.isNarrow ? 38 : 44,
      height: options.isNarrow ? 38 : 44,
      borderRadius: options.isNarrow ? 12 : 14,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      backgroundColor: colors.backgroundSecondary,
      flexShrink: 0,
      marginHorizontal: 0,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
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
    sheetShowResultsButton: {
      flexDirection: 'row' as const,
      height: options.isNarrow ? 38 : 44,
      minWidth: options.isNarrow ? 38 : 44,
      paddingHorizontal: options.isNarrow ? 8 : 12,
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
      height: 44,
      minWidth: 44,
      paddingHorizontal: 10,
    },
    sheetPrimaryActionText: {
      fontSize: options.isNarrow ? 12 : 13,
      fontWeight: '800' as const,
      color: colors.textOnPrimary,
      letterSpacing: 0.1,
    },
    sheetToolbarButtonStacked: {
      width: '100%',
      minWidth: 0,
    },
    sheetBackToMapButton: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 4,
      height: options.isNarrow ? 38 : 44,
      minWidth: options.isNarrow ? 38 : 44,
      paddingHorizontal: options.isNarrow ? 8 : 12,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      backgroundColor: colors.backgroundSecondary,
      flexShrink: 0,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: 'none',
            cursor: 'pointer',
          } as any)
        : null),
    },
    sheetBackToMapButtonCompact: {
      width: 44,
      height: 44,
      paddingHorizontal: 0,
      borderRadius: 12,
    },
    sheetBackToMapText: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: colors.textMuted,
    },
    sheetIconButtonCompact: {
      width: 44,
      height: 44,
      borderRadius: 12,
    },
    sheetIconButtonStacked: {
      width: '100%',
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
      flex: options.stackSheetToolbar ? 0 : 1,
      minWidth: 0,
      flexShrink: 1,
    },
    sheetToolbarSummary: {
      marginTop: options.isNarrow ? 3 : 6,
      fontSize: 11,
      lineHeight: options.isNarrow ? 14 : 15,
      fontWeight: '600' as const,
      color: colors.textMuted,
    },
    sheetToolbarSummaryPreview: {
      marginTop: 2,
      fontSize: 10,
      lineHeight: 13,
    },
    sheetToolbarRight: {
      flex: options.stackSheetToolbar ? 0 : 1,
      minWidth: 0,
    },
    sheetToolbarInline: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sheetToolbarStacked: {
      flexDirection: 'column',
      alignItems: 'stretch',
    },
    sheetToolbarFullWidth: {
      width: '100%',
      minHeight: 34,
    },
    sheetIconButton: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      backgroundColor: colors.backgroundSecondary,
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
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      backgroundColor: colors.backgroundSecondary,
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
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minHeight: 0,
      ...Platform.select({
        web: {
          paddingHorizontal: options.isNarrow ? 6 : 14,
        },
      }),
    },
    sheetBodyPreview: {
      ...Platform.select({
        web: {
          paddingHorizontal: options.isNarrow ? 4 : 8,
        },
        default: {},
      }),
    },
    sheetTransitionState: {
      flex: 1,
      minHeight: 0,
      paddingHorizontal: options.isNarrow ? 8 : 12,
      paddingVertical: options.isNarrow ? 12 : 16,
      justifyContent: 'flex-start',
    },
    sheetTransitionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      paddingHorizontal: options.isNarrow ? 12 : 14,
      paddingVertical: options.isNarrow ? 12 : 14,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 8px 22px rgba(0,0,0,0.06)',
          } as any)
        : {
            shadowColor: DESIGN_TOKENS.colors.text,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.06,
            shadowRadius: 10,
            elevation: 2,
          }),
    },
    sheetTransitionIconWrap: {
      width: options.isNarrow ? 40 : 44,
      height: options.isNarrow ? 40 : 44,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      flexShrink: 0,
    },
    sheetTransitionCopy: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    sheetTransitionTitle: {
      fontSize: options.isNarrow ? 13 : 14,
      lineHeight: options.isNarrow ? 17 : 18,
      fontWeight: '800' as const,
      color: colors.text,
    },
    sheetTransitionText: {
      fontSize: options.isNarrow ? 11 : 12,
      lineHeight: options.isNarrow ? 15 : 17,
      fontWeight: '500' as const,
      color: colors.textMuted,
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
