import React, { memo, useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { useLocale } from '@/i18n/LocaleProvider'
import { getLocaleDisplayCode, getLocaleDisplayName } from '@/i18n/localeLabels'
import { translate as i18nT } from '@/i18n'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

function HomeLanguageQuickPicker() {
  const colors = useThemedColors()
  const { locale, setLocale, supportedLocales } = useLocale()
  const styles = useMemo(() => createStyles(colors), [colors])

  return (
    <View
      style={styles.container}
      testID="home-language-quick-picker"
      accessibilityLabel={i18nT('common:language.quickPickerTitle')}
    >
      <View style={styles.labelWrap}>
        <View style={styles.iconWrap}>
          <Feather name="globe" size={15} color={colors.primaryText} />
        </View>
        <View style={styles.copyWrap}>
          <Text style={styles.title}>{i18nT('common:language.quickPickerTitle')}</Text>
          <Text style={styles.hint}>{i18nT('common:language.quickPickerHint')}</Text>
        </View>
      </View>

      <View style={styles.options}>
        {supportedLocales.map((supportedLocale) => {
          const active = supportedLocale === locale
          const label = getLocaleDisplayCode(supportedLocale)
          const name = getLocaleDisplayName(supportedLocale)

          return (
            <Pressable
              key={supportedLocale}
              onPress={() => {
                if (!active) void setLocale(supportedLocale)
              }}
              style={({ pressed }) => [
                styles.option,
                active && styles.optionActive,
                pressed && !active && styles.optionPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={i18nT('common:language.quickPickerOptionA11y', { value1: name })}
              accessibilityState={{ selected: active }}
              disabled={active}
            >
              <Text style={[styles.optionText, active && styles.optionTextActive]}>
                {label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    container: {
      width: '100%',
      maxWidth: 620,
      alignSelf: 'flex-start',
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    labelWrap: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconWrap: {
      width: 30,
      height: 30,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
      flexShrink: 0,
    },
    copyWrap: {
      minWidth: 0,
      flex: 1,
      gap: 1,
    },
    title: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 16,
      fontWeight: '700',
      letterSpacing: 0,
    },
    hint: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '500',
      letterSpacing: 0,
    },
    options: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      gap: 5,
      flexShrink: 1,
      width: '100%',
      maxWidth: '100%',
    },
    option: {
      minWidth: 36,
      minHeight: 32,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
      borderRadius: 8,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    optionPressed: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
    },
    optionActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    optionText: {
      color: colors.text,
      fontSize: 12,
      lineHeight: 14,
      fontWeight: '800',
      letterSpacing: 0,
    },
    optionTextActive: {
      color: colors.textOnPrimary,
    },
  })

export default memo(HomeLanguageQuickPicker)
