import React, { useMemo } from 'react'
import Feather from '@expo/vector-icons/Feather'
import { MD3DarkTheme, MD3LightTheme as DefaultTheme, PaperProvider } from 'react-native-paper'

import { useTheme, useThemedColors } from '@/hooks/useTheme'

type Props = { children: React.ReactNode }

export default function ThemedPaperProvider({ children }: Props) {
  const { isDark } = useTheme()
  const colors = useThemedColors()

  const paperTheme = useMemo(() => {
    const baseTheme = isDark ? MD3DarkTheme : DefaultTheme
    return {
      ...baseTheme,
      dark: isDark,
      colors: {
        ...baseTheme.colors,
        primary: colors.primary,
        secondary: colors.primaryDark,
        background: colors.background,
        surface: colors.surface,
        error: colors.danger,
        outline: colors.border,
        onPrimary: colors.textOnPrimary,
        onSecondary: colors.text,
      },
      fonts: { ...baseTheme.fonts },
    }
  }, [colors, isDark])

  return (
    <PaperProvider
      theme={paperTheme}
      settings={{
        icon: (props: any) => {
          const name = props?.name
          return <Feather {...props} name={name} />
        },
      }}
    >
      {children}
    </PaperProvider>
  )
}
