import Feather from '@expo/vector-icons/Feather'
import { useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { useLocale } from '@/i18n/LocaleProvider'
import { getLocaleDisplayCode, getLocaleDisplayName } from '@/i18n/localeLabels'
import { translate as i18nT } from '@/i18n'
import { useThemedColors } from '@/hooks/useTheme'
import { DialogMenu } from '@/ui/paper'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { webAccessibilityProps, webViewStyle } from '@/utils/webProps'

type LanguageSwitcherProps = {
  compact?: boolean
}

export default function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const { locale, setLocale, supportedLocales } = useLocale()
  const [visible, setVisible] = useState(false)
  const currentLanguage = getLocaleDisplayName(locale)
  const accessibilityLabel = `${i18nT('common:language.headerLabel')}: ${currentLanguage}`

  const chooseLocale = (nextLocale: typeof locale) => {
    setVisible(false)
    if (nextLocale !== locale) void setLocale(nextLocale)
  }

  return (
    <DialogMenu
      visible={visible}
      onDismiss={() => setVisible(false)}
      accessibilityLabel={i18nT('common:language.settingTitle')}
      contentStyle={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border }]}
      anchor={
        <Pressable
          onPress={() => setVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ expanded: visible }}
          style={({ pressed }) => [
            styles.anchor,
            compact && styles.anchorCompact,
            (pressed || visible) && styles.anchorActive,
          ]}
          testID="header-language-switcher"
          {...(Platform.OS === 'web'
            ? webAccessibilityProps({
                'aria-haspopup': 'dialog',
                'aria-expanded': visible,
              })
            : {})}
        >
          <Feather name="globe" size={17} color={colors.textMuted} />
          <Text style={styles.code}>{getLocaleDisplayCode(locale)}</Text>
          {!compact ? (
            <Feather
              name={visible ? 'chevron-up' : 'chevron-down'}
              size={15}
              color={colors.textMuted}
            />
          ) : null}
        </Pressable>
      }
    >
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
              testID={`header-language-option-${supportedLocale}`}
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
    </DialogMenu>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    anchor: {
      minWidth: 74,
      minHeight: 44,
      paddingHorizontal: 10,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      backgroundColor: colors.backgroundSecondary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      flexShrink: 0,
      ...Platform.select({ web: webViewStyle({ cursor: 'pointer' }) }),
    },
    anchorCompact: {
      minWidth: 54,
      paddingHorizontal: 8,
    },
    anchorActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    code: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.4,
    },
    menu: {
      width: 220,
      paddingVertical: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: DESIGN_TOKENS.radii.md,
      ...Platform.select({
        web: webViewStyle({ boxShadow: DESIGN_TOKENS.shadows.card }),
      }),
    },
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
