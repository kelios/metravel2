import React, { memo, useCallback, useState } from 'react'
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'


type HomeHeroSearchBarProps = {
  colors: ThemedColors
  isMobile: boolean
  onSubmit: (query: string) => void
  useBookPaperColors?: boolean
}

function HomeHeroSearchBar({
  colors,
  isMobile,
  onSubmit,
  useBookPaperColors = false,
}: HomeHeroSearchBarProps) {
  const [value, setValue] = useState('')
  const styles = React.useMemo(
    () => createStyles(colors, isMobile, useBookPaperColors),
    [colors, isMobile, useBookPaperColors],
  )
  const inputTextColor = useBookPaperColors
    ? DESIGN_TOKENS.colors.bookPageText
    : colors.text
  const inputMutedColor = useBookPaperColors
    ? DESIGN_TOKENS.colors.bookPageTextMuted
    : colors.textMuted

  const handleSubmit = useCallback(() => {
    onSubmit(value)
  }, [onSubmit, value])

  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        <Feather name="search" size={18} color={inputMutedColor} />
        <TextInput
          value={value}
          onChangeText={setValue}
          onSubmitEditing={handleSubmit}
          placeholder={Platform.OS === 'web' ? i18nT('home:components.home.HomeHeroSearchBar.kuda_hotite_poehat_gorod_ozero_zamok_5ca126e6') : i18nT('home:components.home.HomeHeroSearchBar.kuda_hotite_poehat_5f13aee9')}
          placeholderTextColor={inputMutedColor}
          returnKeyType="search"
          style={[styles.input, { color: inputTextColor }]}
          accessibilityLabel={i18nT('home:components.home.HomeHeroSearchBar.poisk_marshrutov_ee35e283')}
          {...(Platform.OS === 'web' ? ({ enterKeyHint: 'search' } as any) : {})}
        />
      </View>
      <Pressable
        onPress={handleSubmit}
        accessibilityRole="button"
        accessibilityLabel={i18nT('home:components.home.HomeHeroSearchBar.nayti_marshruty_2aac9702')}
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

const createStyles = (
  colors: ThemedColors,
  isMobile: boolean,
  useBookPaperColors: boolean,
) =>
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
      borderColor: useBookPaperColors
        ? DESIGN_TOKENS.colors.bookPageBorder
        : colors.border,
      backgroundColor: useBookPaperColors
        ? DESIGN_TOKENS.colors.bookPageSurface
        : colors.surface,
    },
    input: {
      flex: 1,
      fontSize: isMobile ? 14 : 15,
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
