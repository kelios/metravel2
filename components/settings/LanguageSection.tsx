import Feather from '@expo/vector-icons/Feather'
import { Platform, Pressable, Text, View } from 'react-native'

import { translate as i18nT } from '@/i18n'
import { useLocale } from '@/i18n/LocaleProvider'
import { getLocaleDisplayName } from '@/i18n/localeLabels'
import type { useThemedColors } from '@/hooks/useTheme'
import type { createSettingsStyles } from '@/components/screens/settings/settings.styles'

type Colors = ReturnType<typeof useThemedColors>
type Styles = ReturnType<typeof createSettingsStyles>

type LanguageSectionProps = {
  colors: Colors
  styles: Styles
}

export default function LanguageSection({ colors, styles }: LanguageSectionProps) {
  const {
    locale,
    preference,
    setLocale,
    supportedLocales,
    useSystemLocale: setSystemLocale,
  } = useLocale()

  const renderOption = ({
    key,
    label,
    description,
    selected,
    onPress,
    code,
  }: {
    key: string
    label: string
    description: string
    selected: boolean
    onPress: () => void
    code?: string
  }) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={({ pressed }) => [
        styles.themeOption,
        selected && styles.themeOptionActive,
        pressed && styles.themeOptionPressed,
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      {...Platform.select({ web: { cursor: 'pointer' } })}
    >
      <View style={[styles.themeOptionIcon, selected && styles.themeOptionIconActive]}>
        {code ? (
          <Text style={{ color: colors.primaryDark, fontSize: 11, fontWeight: '700' }}>
            {code}
          </Text>
        ) : (
          <Feather name="smartphone" size={16} color={colors.primaryDark} />
        )}
      </View>
      <View style={styles.themeOptionText}>
        <Text style={styles.themeOptionTitle}>{label}</Text>
        <Text style={styles.themeOptionDescription}>{description}</Text>
      </View>
      {selected ? <Feather name="check" size={16} color={colors.primaryDark} /> : null}
    </Pressable>
  )

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.cardIcon}>
          <Feather name="globe" size={18} color={colors.primaryDark} />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>{i18nT('common:language.settingTitle')}</Text>
          <Text style={styles.cardMeta}>{i18nT('common:language.settingDescription')}</Text>
        </View>
      </View>

      <View
        style={styles.themeOptions}
        accessibilityRole="radiogroup"
        accessibilityLabel={i18nT('common:language.settingTitle')}
      >
        {renderOption({
          key: 'system',
          label: i18nT('common:language.system'),
          description: i18nT('common:language.systemDescription'),
          selected: preference.mode === 'system',
          onPress: () => void setSystemLocale(),
        })}
        {supportedLocales.map((supportedLocale) =>
          renderOption({
            key: supportedLocale,
            label: getLocaleDisplayName(supportedLocale),
            description: supportedLocale.toUpperCase(),
            code: supportedLocale.toUpperCase(),
            selected:
              preference.mode === 'explicit' && locale === supportedLocale,
            onPress: () => void setLocale(supportedLocale),
          }),
        )}
      </View>
    </View>
  )
}
