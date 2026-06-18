import { Platform, StyleSheet } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { ThemedColors } from '@/hooks/useTheme'

const BUTTON_SIZE = 44

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
      // Прижимаем компактную панель из иконок к правому краю (FAB-стиль).
      alignItems: 'flex-end',
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      // 5 кнопок по 44px + 4 зазора по 8 + горизонтальные паддинги root (12×2)
      // = 284px — помещается даже на 320px-экране в один ряд без переноса.
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
      top: -4,
      right: -4,
      minWidth: 20,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      backgroundColor: colors.primary,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderWidth: 1.5,
      borderColor: colors.surface,
    },
    badgeText: {
      fontSize: 10,
      lineHeight: 12,
      fontWeight: '700' as const,
      color: colors.textOnPrimary,
    },
  })
