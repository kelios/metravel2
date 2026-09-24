import type { getThemedColors } from '@/constants/designSystem'

type ThemedColors = ReturnType<typeof getThemedColors>

/** Colors the navigation container must take from the app theme (#2095). */
export function navigationThemeColors(colors: ThemedColors) {
  return {
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.danger,
  }
}
