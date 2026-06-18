import { Platform, StyleSheet } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { ThemedColors } from '@/hooks/useTheme'

const RADIUS = 12
const PILL = DESIGN_TOKENS.radii.pill

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
      zIndex: 1500,
      paddingHorizontal: 12,
      gap: 8,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    searchBar: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 48,
      paddingHorizontal: 14,
      borderRadius: RADIUS,
      // Статичный «фрост» вместо живого blur (правило проекта).
      backgroundColor: colors.surface,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
      ...(Platform.OS === 'web' ? shadowWeb : shadowNative),
    },
    searchText: {
      flex: 1,
      minWidth: 0,
      fontSize: 15,
      fontWeight: '600' as const,
      color: colors.textMuted,
    },
    filtersButton: {
      width: 48,
      height: 48,
      borderRadius: RADIUS,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: colors.surface,
      flexShrink: 0,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
      ...(Platform.OS === 'web' ? shadowWeb : shadowNative),
    },
    chipsScroll: {
      flexGrow: 0,
      ...(Platform.OS === 'web' ? ({ overflow: 'visible' } as any) : null),
    },
    chipsContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingRight: 12,
      paddingVertical: 2,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      minHeight: 36,
      paddingHorizontal: 14,
      borderRadius: PILL,
      backgroundColor: colors.surface,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 1px 6px rgba(15,23,42,0.10)' } as any)
        : {
            shadowColor: DESIGN_TOKENS.colors.text,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
            elevation: 2,
          }),
    },
    chipRadius: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
    },
    chipRadiusText: {
      color: colors.primary,
      fontWeight: '700' as const,
    },
    chipSelected: {
      backgroundColor: colors.primary,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: colors.text,
      maxWidth: 160,
    },
    chipTextSelected: {
      color: colors.textOnPrimary,
    },
  })
