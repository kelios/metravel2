import Feather from '@expo/vector-icons/Feather'
import { useMemo } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { useLocale } from '@/i18n/LocaleProvider'
import { getLocaleDisplayCode, getLocaleDisplayName } from '@/i18n/localeLabels'
import { useThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { webViewStyle } from '@/utils/webProps'

type LanguageOptionListProps = {
  /** Вызывается после выбора (закрыть меню/лист). */
  onChosen?: () => void
  /** Префикс testID пунктов: шапка — `header-language-option`, «Ещё» — свой. */
  testIDPrefix?: string
}

/**
 * Единственный список выбора языка (#2100): его показывают переключатель в
 * бренд-строке (`LanguageSwitcher`) и пункт «Язык интерфейса» меню «Ещё»
 * (`LanguageSheet`). Один radiogroup — одна логика смены локали.
 */
export default function LanguageOptionList({
  onChosen,
  testIDPrefix = 'header-language-option',
}: LanguageOptionListProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const { locale, setLocale, supportedLocales } = useLocale()

  const chooseLocale = (nextLocale: typeof locale) => {
    onChosen?.()
    if (nextLocale !== locale) void setLocale(nextLocale)
  }

  return (
    <View accessibilityRole="radiogroup">
      {supportedLocales.map((supportedLocale) => {
        const selected = locale === supportedLocale
        const label = getLocaleDisplayName(supportedLocale)
        return (
          <Pressable
            key={supportedLocale}
            onPress={() => chooseLocale(supportedLocale)}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ checked: selected }}
            style={({ pressed }) => [
              styles.option,
              selected && styles.optionSelected,
              pressed && styles.optionPressed,
            ]}
            testID={`${testIDPrefix}-${supportedLocale}`}
          >
            <View style={styles.optionCodeSlot}>
              <Text style={[styles.optionCode, selected && styles.optionCodeSelected]}>
                {getLocaleDisplayCode(supportedLocale)}
              </Text>
            </View>
            <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
              {label}
            </Text>
            {selected ? <Feather name="check" size={17} color={colors.primary} /> : null}
          </Pressable>
        )
      })}
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    option: {
      minHeight: 44,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      ...Platform.select({ web: webViewStyle({ cursor: 'pointer' }) }),
    },
    optionSelected: {
      backgroundColor: colors.primarySoft,
    },
    optionPressed: {
      opacity: 0.82,
    },
    optionCodeSlot: {
      width: 34,
      height: 28,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionCode: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    optionCodeSelected: {
      color: colors.primary,
    },
    optionLabel: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      fontWeight: '500',
    },
    optionLabelSelected: {
      color: colors.primary,
      fontWeight: '700',
    },
  })
