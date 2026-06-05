import React, { memo, useCallback, useState } from 'react'
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { ThemedColors } from '@/hooks/useTheme'

type HomeHeroSearchBarProps = {
  colors: ThemedColors
  isMobile: boolean
  onSubmit: (query: string) => void
}

function HomeHeroSearchBar({ colors, isMobile, onSubmit }: HomeHeroSearchBarProps) {
  const [value, setValue] = useState('')
  const styles = React.useMemo(() => createStyles(colors, isMobile), [colors, isMobile])

  const handleSubmit = useCallback(() => {
    onSubmit(value)
  }, [onSubmit, value])

  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        <Feather name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={value}
          onChangeText={setValue}
          onSubmitEditing={handleSubmit}
          placeholder="Куда хотите поехать? Город, озеро, замок…"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          style={styles.input}
          accessibilityLabel="Поиск маршрутов"
          {...(Platform.OS === 'web' ? ({ enterKeyHint: 'search' } as any) : {})}
        />
      </View>
      <Pressable
        onPress={handleSubmit}
        accessibilityRole="button"
        accessibilityLabel="Найти маршруты"
        style={({ pressed, hovered }: any) => [
          styles.button,
          (pressed || hovered) && styles.buttonHover,
        ]}
      >
        <Feather name="search" size={18} color={colors.textOnPrimary} />
      </Pressable>
    </View>
  )
}

const createStyles = (colors: ThemedColors, isMobile: boolean) =>
  StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' },
    field: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: isMobile ? 46 : 50,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    input: {
      flex: 1,
      fontSize: isMobile ? 14 : 15,
      color: colors.text,
      ...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} }),
    },
    button: {
      width: isMobile ? 46 : 50,
      height: isMobile ? 46 : 50,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    buttonHover: Platform.select({
      web: { opacity: 0.9 } as any,
      default: {},
    }) as any,
  })

export default memo(HomeHeroSearchBar)
